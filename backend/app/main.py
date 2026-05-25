from uuid import uuid4
from collections.abc import AsyncGenerator
import logging

from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import os
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.websockets import WebSocketDisconnect as StarletteWebSocketDisconnect

from .config import settings
from .db import Base, create_engine, create_session_factory
from .models import Room
from .room_codes import generate_room_code
from .schemas import CreateRoomRequest, CreateRoomResponse, JoinRoomRequest, JoinRoomResponse

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
        room = Room(code=code, max_players=payload.max_players)
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
        await session.delete(room)
        await session.commit()
        logger.info("Deleted empty room %s", room_code)


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
                await manager.broadcast(room_code, data)
                continue
            await manager.broadcast(room_code, {"type": "message", "payload": data})
    except WebSocketDisconnect:
        manager.disconnect(room_code, websocket)
        remaining = manager.get_presence(room_code)
        if remaining == 0:
            await delete_room_record(room_code)
            return
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
