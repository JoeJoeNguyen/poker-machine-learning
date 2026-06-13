"""add room history and chat logs

Revision ID: 20260612_0002
Revises: 20260523_0001
Create Date: 2026-06-12 00:00:00
"""
from alembic import op
import sqlalchemy as sa

revision = "20260612_0002"
down_revision = "20260523_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("rooms", sa.Column("active_players", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("rooms", sa.Column("player_names", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")))
    op.add_column("rooms", sa.Column("hands_played", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("rooms", sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()))
    op.add_column("rooms", sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        "room_chat_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("room_id", sa.Integer(), sa.ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("room_code", sa.String(length=12), nullable=False),
        sa.Column("client_message_id", sa.String(length=120), nullable=True),
        sa.Column("author", sa.String(length=120), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_room_chat_logs_room_id", "room_chat_logs", ["room_id"])
    op.create_index("ix_room_chat_logs_room_code", "room_chat_logs", ["room_code"])
    op.create_index("ix_room_chat_logs_client_message_id", "room_chat_logs", ["client_message_id"])
    op.create_index("ix_room_chat_logs_created_at", "room_chat_logs", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_room_chat_logs_created_at", table_name="room_chat_logs")
    op.drop_index("ix_room_chat_logs_client_message_id", table_name="room_chat_logs")
    op.drop_index("ix_room_chat_logs_room_code", table_name="room_chat_logs")
    op.drop_index("ix_room_chat_logs_room_id", table_name="room_chat_logs")
    op.drop_table("room_chat_logs")

    op.drop_column("rooms", "closed_at")
    op.drop_column("rooms", "updated_at")
    op.drop_column("rooms", "hands_played")
    op.drop_column("rooms", "player_names")
    op.drop_column("rooms", "active_players")
