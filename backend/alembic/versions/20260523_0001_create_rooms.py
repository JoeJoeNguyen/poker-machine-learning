"""create rooms table

Revision ID: 20260523_0001
Revises: 
Create Date: 2026-05-23 00:00:00
"""
from alembic import op
import sqlalchemy as sa

revision = "20260523_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "rooms",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("code", sa.String(length=12), nullable=False, unique=True),
        sa.Column("max_players", sa.Integer, nullable=False, server_default="6"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_rooms_code", "rooms", ["code"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_rooms_code", table_name="rooms")
    op.drop_table("rooms")
