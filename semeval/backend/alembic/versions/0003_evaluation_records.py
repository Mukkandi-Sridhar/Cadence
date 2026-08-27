"""evaluation_records

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-27

Creates `evaluation_records` table for Supabase REST API & database persistence.
"""

from __future__ import annotations

from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── evaluation_records ───────────────────────────────────────────────────
    op.create_table(
        "evaluation_records",
        sa.Column("id", sa.Text, primary_key=True),
        sa.Column("session_id", sa.Text, nullable=False),
        sa.Column("recording_id", sa.Text, nullable=False),
        sa.Column("presenter_name", sa.Text, nullable=False),
        sa.Column("total_score", sa.Integer, nullable=False),
        sa.Column("audio_quality", sa.Text, nullable=False, server_default="PASS"),
        sa.Column("model_name", sa.Text, nullable=False),
        sa.Column("model_version", sa.Text, nullable=False),
        sa.Column("prompt_hash", sa.Text, nullable=False),
        sa.Column("temperature", sa.Float, nullable=False, server_default="0.0"),
        sa.Column("seed", sa.Integer, nullable=False, server_default="42"),
        sa.Column("dimension_scores", JSONB, nullable=False, server_default="[]"),
        sa.Column("strengths", JSONB, nullable=False, server_default="[]"),
        sa.Column("improvements", JSONB, nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_index("ix_evaluation_records_session_id", "evaluation_records", ["session_id"])


def downgrade() -> None:
    op.drop_index("ix_evaluation_records_session_id")
    op.drop_table("evaluation_records")
