"""initial_schema

Revision ID: 0001
Revises:
Create Date: 2026-08-24

Creates all 16 tables for the Semeval platform:
  tenants, users, rubrics, rubric_versions, events, sessions,
  presenters, voice_enrollments, recordings, audio_chunks, transcripts,
  transcript_segments, evaluations, agent_runs, dimension_scores, evidence,
  overrides, audit_log, export_jobs
"""

from __future__ import annotations

from typing import Sequence

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── Enable pgvector extension ──────────────────────────────────────────────
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # ── tenants ───────────────────────────────────────────────────────────────
    op.create_table(
        "tenants",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("slug", sa.Text, nullable=False, unique=True),
        sa.Column("settings", JSONB, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ── users ─────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("tenant_id", UUID(as_uuid=False), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("email", sa.Text, nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("password_hash", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("tenant_id", "email", name="uq_users_tenant_email"),
    )

    # ── rubrics ───────────────────────────────────────────────────────────────
    op.create_table(
        "rubrics",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("tenant_id", UUID(as_uuid=False), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ── rubric_versions ───────────────────────────────────────────────────────
    op.create_table(
        "rubric_versions",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("rubric_id", UUID(as_uuid=False), sa.ForeignKey("rubrics.id"), nullable=False),
        sa.Column("version", sa.Integer, nullable=False),
        sa.Column("dimensions", JSONB, nullable=False),
        sa.Column("weights_sum", sa.Integer, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("rubric_id", "version", name="uq_rubric_version"),
    )

    # ── events ────────────────────────────────────────────────────────────────
    op.create_table(
        "events",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("tenant_id", UUID(as_uuid=False), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("organizer_id", UUID(as_uuid=False), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ── sessions ──────────────────────────────────────────────────────────────
    op.create_table(
        "sessions",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("event_id", UUID(as_uuid=False), sa.ForeignKey("events.id"), nullable=False),
        sa.Column("rubric_version_id", UUID(as_uuid=False), sa.ForeignKey("rubric_versions.id"), nullable=False),
        sa.Column("topic", sa.Text, nullable=False),
        sa.Column("coverage_points", JSONB, nullable=False, server_default="[]"),
        sa.Column("target_duration_s", sa.Integer, nullable=False),
        sa.Column("grace_period_s", sa.Integer, nullable=False, server_default="60"),
        sa.Column("min_duration_s", sa.Integer, nullable=False, server_default="120"),
        sa.Column("consent_recorded", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("status", sa.String(20), nullable=False, server_default="PENDING"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ── presenters ────────────────────────────────────────────────────────────
    op.create_table(
        "presenters",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("session_id", UUID(as_uuid=False), sa.ForeignKey("sessions.id"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=False), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("queue_order", sa.Integer, nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="QUEUED"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # ── voice_enrollments ─────────────────────────────────────────────────────
    op.create_table(
        "voice_enrollments",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("presenter_id", UUID(as_uuid=False), sa.ForeignKey("presenters.id"), nullable=False),
        sa.Column("storage_key", sa.Text, nullable=False),
        sa.Column("embedding", Vector(192), nullable=True),
        sa.Column("enrolled_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # ── recordings ────────────────────────────────────────────────────────────
    op.create_table(
        "recordings",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("presenter_id", UUID(as_uuid=False), sa.ForeignKey("presenters.id"), nullable=False),
        sa.Column("session_id", UUID(as_uuid=False), sa.ForeignKey("sessions.id"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="RECORDING"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("stopped_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_ms", sa.Integer, nullable=True),
        sa.Column("device_id", sa.Text, nullable=True),
        sa.Column("storage_key", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # ── audio_chunks ──────────────────────────────────────────────────────────
    op.create_table(
        "audio_chunks",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("recording_id", UUID(as_uuid=False), sa.ForeignKey("recordings.id"), nullable=False),
        sa.Column("seq", sa.Integer, nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("byte_size", sa.Integer, nullable=False),
        sa.Column("storage_key", sa.Text, nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("gap_before_ms", sa.Integer, nullable=True),
        sa.UniqueConstraint("recording_id", "seq", name="uq_chunk_recording_seq"),
    )

    # ── transcripts ───────────────────────────────────────────────────────────
    op.create_table(
        "transcripts",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("recording_id", UUID(as_uuid=False), sa.ForeignKey("recordings.id"), nullable=False),
        sa.Column("asr_adapter", sa.Text, nullable=False),
        sa.Column("language", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # ── transcript_segments ───────────────────────────────────────────────────
    op.create_table(
        "transcript_segments",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("transcript_id", UUID(as_uuid=False), sa.ForeignKey("transcripts.id"), nullable=False),
        sa.Column("segment_id", sa.Text, nullable=False),
        sa.Column("start_ms", sa.Integer, nullable=False),
        sa.Column("end_ms", sa.Integer, nullable=False),
        sa.Column("text", sa.Text, nullable=False),
        sa.Column("confidence", sa.Float, nullable=False),
        sa.Column("language", sa.Text, nullable=False),
        sa.Column("speaker_role", sa.Text, nullable=True),
        sa.Column("speaker_label", sa.Text, nullable=True),
        sa.Column("words", JSONB, nullable=True),
    )

    # ── evaluations ───────────────────────────────────────────────────────────
    op.create_table(
        "evaluations",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("recording_id", UUID(as_uuid=False), sa.ForeignKey("recordings.id"), nullable=False),
        sa.Column("presenter_id", UUID(as_uuid=False), sa.ForeignKey("presenters.id"), nullable=False),
        sa.Column("rubric_version_id", UUID(as_uuid=False), sa.ForeignKey("rubric_versions.id"), nullable=False),
        sa.Column("model_name", sa.Text, nullable=False),
        sa.Column("model_version", sa.Text, nullable=False),
        sa.Column("prompt_hash", sa.Text, nullable=False),
        sa.Column("temperature", sa.Float, nullable=False),
        sa.Column("seed", sa.Integer, nullable=True),
        sa.Column("total_score", sa.Integer, nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="PENDING"),
        sa.Column("audio_quality", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # ── agent_runs ────────────────────────────────────────────────────────────
    op.create_table(
        "agent_runs",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("evaluation_id", UUID(as_uuid=False), sa.ForeignKey("evaluations.id"), nullable=False),
        sa.Column("agent_name", sa.Text, nullable=False),
        sa.Column("attempt", sa.Integer, nullable=False, server_default="1"),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("model_name", sa.Text, nullable=True),
        sa.Column("model_version", sa.Text, nullable=True),
        sa.Column("prompt_hash", sa.Text, nullable=True),
        sa.Column("temperature", sa.Float, nullable=True),
        sa.Column("seed", sa.Integer, nullable=True),
        sa.Column("input_hash", sa.Text, nullable=True),
        sa.Column("output", JSONB, nullable=True),
        sa.Column("error", sa.Text, nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ── dimension_scores ──────────────────────────────────────────────────────
    op.create_table(
        "dimension_scores",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("evaluation_id", UUID(as_uuid=False), sa.ForeignKey("evaluations.id"), nullable=False),
        sa.Column("dimension", sa.Text, nullable=False),
        sa.Column("weight", sa.Float, nullable=False),
        sa.Column("raw_sub_score", sa.Float, nullable=True),
        sa.Column("scaled_score", sa.Float, nullable=True),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("model_used", sa.Text, nullable=True),
    )

    # ── evidence ──────────────────────────────────────────────────────────────
    op.create_table(
        "evidence",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("dimension_score_id", UUID(as_uuid=False), sa.ForeignKey("dimension_scores.id"), nullable=False),
        sa.Column("transcript_span", sa.Text, nullable=False),
        sa.Column("start_ms", sa.Integer, nullable=False),
        sa.Column("end_ms", sa.Integer, nullable=False),
        sa.Column("reason", sa.Text, nullable=False),
        sa.Column("verified", sa.Boolean, nullable=False, server_default="false"),
    )

    # ── overrides ─────────────────────────────────────────────────────────────
    op.create_table(
        "overrides",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("evaluation_id", UUID(as_uuid=False), sa.ForeignKey("evaluations.id"), nullable=False),
        sa.Column("dimension", sa.Text, nullable=True),
        sa.Column("original_score", sa.Float, nullable=False),
        sa.Column("override_score", sa.Float, nullable=False),
        sa.Column("actor_id", UUID(as_uuid=False), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("reason", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # ── audit_log ─────────────────────────────────────────────────────────────
    op.create_table(
        "audit_log",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("tenant_id", UUID(as_uuid=False), nullable=False),
        sa.Column("actor_id", UUID(as_uuid=False), nullable=True),
        sa.Column("entity_type", sa.Text, nullable=False),
        sa.Column("entity_id", UUID(as_uuid=False), nullable=False),
        sa.Column("action", sa.Text, nullable=False),
        sa.Column("before", JSONB, nullable=True),
        sa.Column("after", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # ── export_jobs ───────────────────────────────────────────────────────────
    op.create_table(
        "export_jobs",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("tenant_id", UUID(as_uuid=False), nullable=False),
        sa.Column("requester_id", UUID(as_uuid=False), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("format", sa.String(10), nullable=False),
        sa.Column("scope", sa.String(20), nullable=False),
        sa.Column("scope_id", UUID(as_uuid=False), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="PENDING"),
        sa.Column("storage_key", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # ── Indexes ────────────────────────────────────────────────────────────────
    op.create_index("ix_audio_chunks_recording_seq", "audio_chunks", ["recording_id", "seq"])
    op.create_index("ix_transcript_segments_transcript_start", "transcript_segments", ["transcript_id", "start_ms"])
    op.create_index("ix_evaluations_recording", "evaluations", ["recording_id"])
    op.create_index("ix_dimension_scores_evaluation", "dimension_scores", ["evaluation_id"])
    op.create_index("ix_audit_log_entity", "audit_log", ["entity_type", "entity_id"])
    op.create_index("ix_audit_log_tenant_created", "audit_log", ["tenant_id", "created_at"])
    # pgvector HNSW index for speaker embedding nearest-neighbour search
    op.execute("CREATE INDEX ix_voice_enrollment_embedding ON voice_enrollments USING hnsw (embedding vector_cosine_ops)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_voice_enrollment_embedding")
    op.drop_index("ix_audit_log_tenant_created")
    op.drop_index("ix_audit_log_entity")
    op.drop_index("ix_dimension_scores_evaluation")
    op.drop_index("ix_evaluations_recording")
    op.drop_index("ix_transcript_segments_transcript_start")
    op.drop_index("ix_audio_chunks_recording_seq")
    op.drop_table("export_jobs")
    op.drop_table("audit_log")
    op.drop_table("overrides")
    op.drop_table("evidence")
    op.drop_table("dimension_scores")
    op.drop_table("agent_runs")
    op.drop_table("evaluations")
    op.drop_table("transcript_segments")
    op.drop_table("transcripts")
    op.drop_table("audio_chunks")
    op.drop_table("recordings")
    op.drop_table("voice_enrollments")
    op.drop_table("presenters")
    op.drop_table("sessions")
    op.drop_table("events")
    op.drop_table("rubric_versions")
    op.drop_table("rubrics")
    op.drop_table("users")
    op.drop_table("tenants")
