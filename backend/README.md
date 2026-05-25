# Poker Rooms Backend

FastAPI + PostgreSQL + WebSocket backend for room creation and join.

## Setup

1. Create a PostgreSQL database (example: `poker`) and user credentials.
2. Create a `.env` file in this folder:

```
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/poker
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
# Optional single frontend URL (also accepted by CORS middleware)
FRONTEND_URL=https://your-frontend-domain.example
```

3. Install dependencies:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

4. Run the server:

```bash
uvicorn app.main:app --reload --port 8000
```

## Migrations (Alembic)

Initialize the schema (optional if you rely on `create_all`):

```bash
alembic -c alembic.ini upgrade head
```

## Endpoints

- `POST /api/rooms` -> create a room, returns a room code
- `POST /api/rooms/join` -> join an existing room by code
- `GET /health`

## WebSocket

- `ws://localhost:8000/ws/rooms/{room_code}`

Messages are broadcast to all connections in the room. Presence updates are sent when clients connect/disconnect.

## Notes

- Persistence uses PostgreSQL. For production, add migrations via Alembic and track active player counts.
