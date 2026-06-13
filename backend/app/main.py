from uuid import uuid4
from collections.abc import AsyncGenerator
from datetime import datetime, timedelta, timezone
import logging

from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import os
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.websockets import WebSocketDisconnect as StarletteWebSocketDisconnect

from .config import settings
from .db import Base, create_engine, create_session_factory
from .models import FeedbackMessage, Room, RoomChatLog
from .room_codes import generate_room_code
from .schemas import (
    CreateRoomRequest,
    CreateRoomResponse,
    FeedbackCreateRequest,
    FeedbackMessageResponse,
    JoinRoomRequest,
    JoinRoomResponse,
    RoomChatLogResponse,
    RoomHistoryResponse,
)

app = FastAPI(title="Poker Rooms API")

# basic logging for websocket debug
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("poker.rooms")

def _load_cors_origins() -> list[str]:
    raw_origins = os.getenv("CORS_ORIGINS", "")
    frontend_url = os.getenv("FRONTEND_URL", "")

    values = []
    if raw_origins:
        values.extend(raw_origins.split(","))
    if frontend_url:
        values.append(frontend_url)

    origins = [origin.strip().rstrip("/") for origin in values if origin.strip()]
    if not origins:
        origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
    return sorted(set(origins))


origins = _load_cors_origins()

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = create_engine()
SessionFactory = create_session_factory(engine)
db_ready = False
ROOM_RETENTION_DAYS = 30


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with SessionFactory() as session:
        yield session


@app.on_event("startup")
async def on_startup() -> None:
    global db_ready
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        db_ready = True
        await prune_expired_room_data()
    except Exception as exc:
        db_ready = False
        logger.exception("Database unavailable during startup: %s", exc)


@app.post("/api/rooms", response_model=CreateRoomResponse)
async def create_room(payload: CreateRoomRequest, session: AsyncSession = Depends(get_session)) -> CreateRoomResponse:
    for _ in range(5):
        code = generate_room_code()
        existing = await session.execute(select(Room).where(Room.code == code))
        if existing.scalar_one_or_none() is not None:
            continue
        room = Room(code=code, max_players=payload.max_players, active_players=0, player_names=[], hands_played=0)
        session.add(room)
        await session.commit()
        await session.refresh(room)
        return CreateRoomResponse(code=room.code, max_players=room.max_players, token=str(uuid4()))

    raise HTTPException(status_code=500, detail="Could not generate unique room code")


@app.post("/api/rooms/join", response_model=JoinRoomResponse)
async def join_room(payload: JoinRoomRequest, session: AsyncSession = Depends(get_session)) -> JoinRoomResponse:
    result = await session.execute(select(Room).where(Room.code == payload.code))
    room = result.scalar_one_or_none()

    if room is None or not room.is_active:
        raise HTTPException(status_code=404, detail="Room not found")

    active_players = manager.get_presence(room.code)
    if active_players >= room.max_players:
        raise HTTPException(status_code=400, detail="Room is full")

    return JoinRoomResponse(code=room.code, max_players=room.max_players, active_players=active_players + 1, token=str(uuid4()))


@app.get("/api/rooms/{room_code}/history", response_model=RoomHistoryResponse)
async def room_history(room_code: str, session: AsyncSession = Depends(get_session)) -> RoomHistoryResponse:
    result = await session.execute(select(Room).where(Room.code == room_code.upper()))
    room = result.scalar_one_or_none()
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")

    chat_result = await session.execute(
        select(RoomChatLog)
        .where(RoomChatLog.room_id == room.id)
        .order_by(RoomChatLog.created_at.desc())
        .limit(200)
    )
    chat_logs = list(reversed(chat_result.scalars().all()))
    return RoomHistoryResponse(
        code=room.code,
        max_players=room.max_players,
        active_players=room.active_players,
        player_names=list(room.player_names or []),
        hands_played=room.hands_played,
        is_active=room.is_active,
        created_at=room.created_at.isoformat() if room.created_at else None,
        updated_at=room.updated_at.isoformat() if room.updated_at else None,
        closed_at=room.closed_at.isoformat() if room.closed_at else None,
        chat_logs=[
            RoomChatLogResponse(
                id=log.id,
                author=log.author,
                message=log.message,
                created_at=log.created_at.isoformat() if log.created_at else None,
            )
            for log in chat_logs
        ],
    )


@app.post("/api/feedback", response_model=FeedbackMessageResponse)
async def create_feedback(
    payload: FeedbackCreateRequest,
    session: AsyncSession = Depends(get_session),
) -> FeedbackMessageResponse:
    feedback = FeedbackMessage(
        name=payload.name.strip(),
        email=payload.email.strip() if payload.email else None,
        message=payload.message.strip(),
    )
    session.add(feedback)
    await session.commit()
    await session.refresh(feedback)
    return FeedbackMessageResponse(
        id=feedback.id,
        name=feedback.name,
        email=feedback.email,
        message=feedback.message,
        created_at=feedback.created_at.isoformat() if feedback.created_at else None,
    )


@app.get("/api/feedback", response_model=list[FeedbackMessageResponse])
async def list_feedback(session: AsyncSession = Depends(get_session)) -> list[FeedbackMessageResponse]:
    result = await session.execute(select(FeedbackMessage).order_by(FeedbackMessage.created_at.desc()))
    rows = result.scalars().all()
    return [
        FeedbackMessageResponse(
            id=row.id,
            name=row.name,
            email=row.email,
            message=row.message,
            created_at=row.created_at.isoformat() if row.created_at else None,
        )
        for row in rows
    ]


class ConnectionManager:
    def __init__(self) -> None:
        self.rooms: dict[str, set[WebSocket]] = {}
        self.room_tokens: dict[str, set[str]] = {}
        self.room_join_order: dict[str, list[str]] = {}
        self.room_names: dict[str, dict[str, str]] = {}
        self.socket_tokens: dict[WebSocket, str] = {}

    async def connect(self, room_code: str, websocket: WebSocket, token: str) -> None:
        await websocket.accept()
        self.rooms.setdefault(room_code, set()).add(websocket)
        self.room_tokens.setdefault(room_code, set()).add(token)
        self.room_join_order.setdefault(room_code, [])
        if token not in self.room_join_order[room_code]:
            self.room_join_order[room_code].append(token)
        self.socket_tokens[websocket] = token

    def disconnect(self, room_code: str, websocket: WebSocket) -> None:
        if room_code in self.rooms:
            self.rooms[room_code].discard(websocket)
            token = self.socket_tokens.pop(websocket, None)
            if token and room_code in self.room_tokens:
                self.room_tokens[room_code].discard(token)
                if room_code in self.room_join_order and token in self.room_join_order[room_code]:
                    self.room_join_order[room_code].remove(token)
                if room_code in self.room_names:
                    self.room_names[room_code].pop(token, None)
                if not self.room_tokens[room_code]:
                    self.room_tokens.pop(room_code, None)
                    self.room_join_order.pop(room_code, None)
                    self.room_names.pop(room_code, None)
            if not self.rooms[room_code]:
                self.rooms.pop(room_code, None)

    def get_presence(self, room_code: str) -> int:
        return len(self.room_tokens.get(room_code, set()))

    def set_name(self, room_code: str, token: str, name: str) -> None:
        if not name:
            return
        self.room_names.setdefault(room_code, {})[token] = name

    def get_names(self, room_code: str) -> list[str]:
        names = []
        token_order = self.room_join_order.get(room_code, [])
        mapped_names = self.room_names.get(room_code, {})
        for index, token in enumerate(token_order):
            names.append(mapped_names.get(token, f"Player {index + 1}"))
        return names

    async def broadcast(self, room_code: str, message: dict) -> None:
        # log broadcasting of game_state for debugging
        try:
            if isinstance(message, dict) and message.get("type") == "game_state":
                logger.info("Broadcasting game_state to room %s", room_code)
        except Exception:
            pass
        stale_sockets: list[WebSocket] = []
        for ws in list(self.rooms.get(room_code, set())):
            try:
                await ws.send_json(message)
            except (StarletteWebSocketDisconnect, RuntimeError):
                stale_sockets.append(ws)
        for ws in stale_sockets:
            self.disconnect(room_code, ws)


async def delete_room_record(room_code: str) -> None:
    async with SessionFactory() as session:
        result = await session.execute(select(Room).where(Room.code == room_code))
        room = result.scalar_one_or_none()
        if room is None:
            return
        room.is_active = False
        room.active_players = 0
        room.closed_at = func.now()
        room.updated_at = func.now()
        await session.commit()
        logger.info("Marked empty room %s inactive", room_code)


async def prune_expired_room_data() -> None:
    async with SessionFactory() as session:
        cutoff = datetime.now(timezone.utc) - timedelta(days=ROOM_RETENTION_DAYS)
        await session.execute(delete(RoomChatLog).where(RoomChatLog.created_at < cutoff))
        await session.execute(delete(Room).where(Room.updated_at < cutoff))
        await session.commit()


async def update_room_presence(room_code: str) -> None:
    async with SessionFactory() as session:
        result = await session.execute(select(Room).where(Room.code == room_code))
        room = result.scalar_one_or_none()
        if room is None:
            return
        names = manager.get_names(room_code)
        room.active_players = manager.get_presence(room_code)
        room.player_names = names
        room.updated_at = func.now()
        if room.active_players > 0:
            room.is_active = True
            room.closed_at = None
        await session.commit()


async def update_room_hand_count(room_code: str, game: dict) -> None:
    hand_number = game.get("handNumber")
    if not isinstance(hand_number, int):
        return
    player_names = [
        str(player.get("name")).strip()
        for player in game.get("players", [])
        if isinstance(player, dict) and str(player.get("name") or "").strip()
    ]
    async with SessionFactory() as session:
        result = await session.execute(select(Room).where(Room.code == room_code))
        room = result.scalar_one_or_none()
        if room is None:
            return
        room.hands_played = max(room.hands_played or 0, hand_number)
        room.player_names = player_names or room.player_names
        room.active_players = manager.get_presence(room_code)
        room.updated_at = func.now()
        await session.commit()


async def store_chat_log(room_code: str, payload: dict) -> None:
    if payload.get("type") != "chat":
        return
    text = str(payload.get("text") or "").strip()
    author = str(payload.get("author") or "Player").strip() or "Player"
    if not text:
        return
    async with SessionFactory() as session:
        result = await session.execute(select(Room).where(Room.code == room_code))
        room = result.scalar_one_or_none()
        if room is None:
            return
        session.add(
            RoomChatLog(
                room_id=room.id,
                room_code=room.code,
                client_message_id=str(payload.get("id") or "").strip() or None,
                author=author[:120],
                message=text[:5000],
            )
        )
        room.updated_at = func.now()
        await session.commit()


manager = ConnectionManager()


@app.websocket("/ws/rooms/{room_code}")
async def room_socket(websocket: WebSocket, room_code: str) -> None:
    token = websocket.query_params.get("token") or str(uuid4())
    await manager.connect(room_code, websocket, token)
    try:
        await manager.broadcast(
            room_code,
            {
                "type": "presence",
                "count": manager.get_presence(room_code),
                "names": manager.get_names(room_code),
            },
        )
        while True:
            data = await websocket.receive_json()
            logger.info("Received WS message in room %s token=%s type=%s", room_code, token, data.get("type"))
            if data.get("type") == "name":
                manager.set_name(room_code, token, str(data.get("name") or "").strip())
                await update_room_presence(room_code)
                await manager.broadcast(
                    room_code,
                    {
                        "type": "presence",
                        "count": manager.get_presence(room_code),
                        "names": manager.get_names(room_code),
                    },
                )
                continue
            if data.get("type") == "game_state":
                logger.info("Relaying game_state from token=%s in room %s (handNumber=%s)", token, room_code, (data.get('game') or {}).get('handNumber'))
                await update_room_hand_count(room_code, data.get("game") or {})
                await manager.broadcast(room_code, data)
                continue
            await store_chat_log(room_code, data)
            await manager.broadcast(room_code, {"type": "message", "payload": data})
    except WebSocketDisconnect:
        manager.disconnect(room_code, websocket)
        remaining = manager.get_presence(room_code)
        if remaining == 0:
            await delete_room_record(room_code)
            return
        await update_room_presence(room_code)
        await manager.broadcast(
            room_code,
            {
                "type": "presence",
                "count": remaining,
                "names": manager.get_names(room_code),
            },
        )


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "database": "ready" if db_ready else "unavailable"}
