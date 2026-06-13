from pydantic import BaseModel, Field


class CreateRoomRequest(BaseModel):
    max_players: int = Field(default=6, ge=2, le=6)


class CreateRoomResponse(BaseModel):
    code: str
    max_players: int
    token: str


class JoinRoomRequest(BaseModel):
    code: str = Field(min_length=4, max_length=12)


class JoinRoomResponse(BaseModel):
    code: str
    max_players: int
    active_players: int
    token: str


class FeedbackCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str | None = Field(default=None, max_length=255)
    message: str = Field(min_length=1, max_length=5000)


class FeedbackMessageResponse(BaseModel):
    id: int
    name: str
    email: str | None = None
    message: str
    created_at: str | None = None


class RoomChatLogResponse(BaseModel):
    id: int
    author: str
    message: str
    created_at: str | None = None


class RoomHistoryResponse(BaseModel):
    code: str
    max_players: int
    active_players: int
    player_names: list[str]
    hands_played: int
    is_active: bool
    created_at: str | None = None
    updated_at: str | None = None
    closed_at: str | None = None
    chat_logs: list[RoomChatLogResponse]
