from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, func

from .db import Base


class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True)
    code = Column(String(12), unique=True, index=True, nullable=False)
    max_players = Column(Integer, nullable=False, default=6)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class FeedbackMessage(Base):
    __tablename__ = "feedback_messages"

    id = Column(Integer, primary_key=True)
    name = Column(String(120), nullable=False)
    email = Column(String(255), nullable=True)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
