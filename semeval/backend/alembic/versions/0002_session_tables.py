"""session_records_and_events

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-27

Creates `session_records` and `session_event_logs` tables for Supabase REST API & real-time sync.
"""

from __future__ import annotations

from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── session_records ───────────────────────────────────────────────────────
    op.create_table(
        "session_records",
        sa.Column("id", sa.Text, primary_key=True),
        sa.Column("topic", sa.Text, nullable=False),
        sa.Column("coverage_points", JSONB, nullable=False, server_default="[]"),
        sa.Column("target_duration_seconds", sa.Integer, nullable=False, server_default="600"),
        sa.Column("presenter_names", JSONB, nullable=False, server_default="[]"),
        sa.Column("status", sa.Text, nullable=False, server_default="PENDING"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # ── session_event_logs ────────────────────────────────────────────────────
    op.create_table(
        "session_event_logs",
        sa.Column("id", sa.Text, primary_key=True),
        sa.Column("session_id", sa.Text, sa.ForeignKey("session_records.id", ondelete="CASCADE"), nullable=False),
        sa.Column("event_type", sa.Text, nullable=False),
        sa.Column("payload", JSONB, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_index("ix_session_event_logs_session_id", "session_event_logs", ["session_id"])


def downgrade() -> None:
    op.drop_index("ix_session_event_logs_session_id")
    op.drop_table("session_event_logs")
    op.drop_table("session_records")
