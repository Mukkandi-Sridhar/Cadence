"""
SQLAlchemy ORM models — all 16 tables.

Design rules (from spec):
- Soft delete everywhere (deleted_at column). Hard delete via retention job only.
- Evaluations are append-only. Re-score = new row.
- AudioChunks have UNIQUE(recording_id, seq) for idempotent upserts.
- Rubric editing creates a new RubricVersion; old versions are never mutated.
- Overrides are separate rows; AI scores are never overwritten.
- AuditLog captures every state transition.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.utcnow()


class Base(DeclarativeBase):
    """Shared base with common columns."""

    pass


# ─────────────────────────────────────────────────────────────────────────────
# Tenant
# ─────────────────────────────────────────────────────────────────────────────


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    slug: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    settings: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    users: Mapped[list[User]] = relationship("User", back_populates="tenant")
    events: Mapped[list[Event]] = relationship("Event", back_populates="tenant")
    rubrics: Mapped[list[Rubric]] = relationship("Rubric", back_populates="tenant")


# ─────────────────────────────────────────────────────────────────────────────
# User
# ─────────────────────────────────────────────────────────────────────────────

ROLES = ("admin", "organizer", "evaluator", "presenter", "viewer")


class User(Base):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("tenant_id", "email", name="uq_users_tenant_email"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    tenant_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("tenants.id"), nullable=False
    )
    email: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    password_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    tenant: Mapped[Tenant] = relationship("Tenant", back_populates="users")
    overrides: Mapped[list[Override]] = relationship("Override", back_populates="actor")


# ─────────────────────────────────────────────────────────────────────────────
# Rubric (versioned)
# ─────────────────────────────────────────────────────────────────────────────


class Rubric(Base):
    __tablename__ = "rubrics"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    tenant_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("tenants.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    tenant: Mapped[Tenant] = relationship("Tenant", back_populates="rubrics")
    versions: Mapped[list[RubricVersion]] = relationship(
        "RubricVersion", back_populates="rubric"
    )


class RubricVersion(Base):
    """Immutable once created. Editing a rubric creates a new version row."""

    __tablename__ = "rubric_versions"
    __table_args__ = (UniqueConstraint("rubric_id", "version", name="uq_rubric_version"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    rubric_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("rubrics.id"), nullable=False
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    # dimensions: [{name, weight, band_descriptors: {0..5: str}}]
    dimensions: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False)
    weights_sum: Mapped[int] = mapped_column(Integer, nullable=False)  # must == 100
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    rubric: Mapped[Rubric] = relationship("Rubric", back_populates="versions")


# ─────────────────────────────────────────────────────────────────────────────
# Event → Session → Presenter chain
# ─────────────────────────────────────────────────────────────────────────────


class Event(Base):
    __tablename__ = "events"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    tenant_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("tenants.id"), nullable=False
    )
    organizer_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    tenant: Mapped[Tenant] = relationship("Tenant", back_populates="events")
    sessions: Mapped[list[Session]] = relationship("Session", back_populates="event")


SESSION_STATUSES = ("PENDING", "RECORDING", "EVALUATING", "COMPLETE", "FAILED")


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    event_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("events.id"), nullable=False
    )
    rubric_version_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("rubric_versions.id"), nullable=False
    )
    topic: Mapped[str] = mapped_column(Text, nullable=False)
    coverage_points: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    target_duration_s: Mapped[int] = mapped_column(Integer, nullable=False)
    grace_period_s: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    min_duration_s: Mapped[int] = mapped_column(Integer, nullable=False, default=120)
    # Consent must be recorded before recording can begin (spec PII section)
    consent_recorded: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="PENDING")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    event: Mapped[Event] = relationship("Event", back_populates="sessions")
    presenters: Mapped[list[Presenter]] = relationship("Presenter", back_populates="session")
    rubric_version: Mapped[RubricVersion] = relationship("RubricVersion")


PRESENTER_STATUSES = ("QUEUED", "RECORDING", "SCORED", "SKIPPED")


class Presenter(Base):
    __tablename__ = "presenters"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    session_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("sessions.id"), nullable=False
    )
    user_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id"), nullable=True
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    queue_order: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="QUEUED")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    session: Mapped[Session] = relationship("Session", back_populates="presenters")
    voice_enrollments: Mapped[list[VoiceEnrollment]] = relationship(
        "VoiceEnrollment", back_populates="presenter"
    )
    recordings: Mapped[list[Recording]] = relationship(
        "Recording", back_populates="presenter"
    )


class VoiceEnrollment(Base):
    __tablename__ = "voice_enrollments"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    presenter_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("presenters.id"), nullable=False
    )
    storage_key: Mapped[str] = mapped_column(Text, nullable=False)
    # 192-dimensional ECAPA-TDNN embedding stored via pgvector
    embedding: Mapped[Any] = mapped_column(Vector(192), nullable=True)
    enrolled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    presenter: Mapped[Presenter] = relationship(
        "Presenter", back_populates="voice_enrollments"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Recording → AudioChunks → Transcript → TranscriptSegments
# ─────────────────────────────────────────────────────────────────────────────

RECORDING_STATUSES = ("RECORDING", "COMPLETE", "PROCESSING", "FAILED")


class Recording(Base):
    __tablename__ = "recordings"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    presenter_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("presenters.id"), nullable=False
    )
    session_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("sessions.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="RECORDING")
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    stopped_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    device_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Assembled audio in object storage (set after all chunks merged)
    storage_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    presenter: Mapped[Presenter] = relationship("Presenter", back_populates="recordings")
    chunks: Mapped[list[AudioChunk]] = relationship(
        "AudioChunk", back_populates="recording", order_by="AudioChunk.seq"
    )
    transcripts: Mapped[list[Transcript]] = relationship(
        "Transcript", back_populates="recording"
    )
    evaluations: Mapped[list[Evaluation]] = relationship(
        "Evaluation", back_populates="recording"
    )


class AudioChunk(Base):
    """
    Each row represents one durable audio chunk written to object storage.
    UNIQUE(recording_id, seq) makes uploads idempotent.
    gap_before_ms records explicit gaps (device switches, tab resumptions).
    """

    __tablename__ = "audio_chunks"
    __table_args__ = (
        UniqueConstraint("recording_id", "seq", name="uq_chunk_recording_seq"),
    )

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    recording_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("recordings.id"), nullable=False
    )
    seq: Mapped[int] = mapped_column(Integer, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    byte_size: Mapped[int] = mapped_column(Integer, nullable=False)
    storage_key: Mapped[str] = mapped_column(Text, nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    # Null means no gap; integer means a gap of this many ms before this chunk
    gap_before_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    recording: Mapped[Recording] = relationship("Recording", back_populates="chunks")


class Transcript(Base):
    __tablename__ = "transcripts"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    recording_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("recordings.id"), nullable=False
    )
    asr_adapter: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    recording: Mapped[Recording] = relationship("Recording", back_populates="transcripts")
    segments: Mapped[list[TranscriptSegment]] = relationship(
        "TranscriptSegment", back_populates="transcript", order_by="TranscriptSegment.start_ms"
    )


class TranscriptSegment(Base):
    __tablename__ = "transcript_segments"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    transcript_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("transcripts.id"), nullable=False
    )
    segment_id: Mapped[str] = mapped_column(Text, nullable=False)
    start_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    end_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    language: Mapped[str] = mapped_column(Text, nullable=False)
    speaker_role: Mapped[str | None] = mapped_column(Text, nullable=True)
    speaker_label: Mapped[str | None] = mapped_column(Text, nullable=True)
    words: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB, nullable=True)

    transcript: Mapped[Transcript] = relationship(
        "Transcript", back_populates="segments"
    )


# ─────────────────────────────────────────────────────────────────────────────
# AgentRun → Evaluation → DimensionScore → Evidence
# ─────────────────────────────────────────────────────────────────────────────

EVALUATION_STATUSES = (
    "PENDING", "RUNNING", "COMPLETE", "FAILED", "LOW_CONFIDENCE", "INSUFFICIENT_SAMPLE"
)
AGENT_RUN_STATUSES = ("RUNNING", "DONE", "FAILED", "RETRIED")
DIMENSION_SCORE_STATUSES = ("SCORED", "SKIPPED", "INSUFFICIENT_EVIDENCE", "LOW_CONFIDENCE")


class Evaluation(Base):
    """Append-only. A re-score creates a new row; old rows are never mutated."""

    __tablename__ = "evaluations"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    recording_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("recordings.id"), nullable=False
    )
    presenter_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("presenters.id"), nullable=False
    )
    rubric_version_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("rubric_versions.id"), nullable=False
    )
    # Reproducibility fields (R3) — pinned at evaluation creation time
    model_name: Mapped[str] = mapped_column(Text, nullable=False)
    model_version: Mapped[str] = mapped_column(Text, nullable=False)
    prompt_hash: Mapped[str] = mapped_column(Text, nullable=False)  # SHA256 of prompt template
    temperature: Mapped[float] = mapped_column(Float, nullable=False)
    seed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="PENDING")
    audio_quality: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    recording: Mapped[Recording] = relationship("Recording", back_populates="evaluations")
    dimension_scores: Mapped[list[DimensionScore]] = relationship(
        "DimensionScore", back_populates="evaluation"
    )
    agent_runs: Mapped[list[AgentRun]] = relationship("AgentRun", back_populates="evaluation")
    overrides: Mapped[list[Override]] = relationship("Override", back_populates="evaluation")


class AgentRun(Base):
    """One row per agent per attempt per evaluation."""

    __tablename__ = "agent_runs"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    evaluation_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("evaluations.id"), nullable=False
    )
    agent_name: Mapped[str] = mapped_column(Text, nullable=False)
    attempt: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    model_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    model_version: Mapped[str | None] = mapped_column(Text, nullable=True)
    prompt_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    temperature: Mapped[float | None] = mapped_column(Float, nullable=True)
    seed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    input_hash: Mapped[str | None] = mapped_column(Text, nullable=True)  # SHA256 of agent input
    output: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    evaluation: Mapped[Evaluation] = relationship("Evaluation", back_populates="agent_runs")


class DimensionScore(Base):
    __tablename__ = "dimension_scores"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    evaluation_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("evaluations.id"), nullable=False
    )
    dimension: Mapped[str] = mapped_column(Text, nullable=False)
    weight: Mapped[float] = mapped_column(Float, nullable=False)
    raw_sub_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    scaled_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    model_used: Mapped[str | None] = mapped_column(Text, nullable=True)

    evaluation: Mapped[Evaluation] = relationship(
        "Evaluation", back_populates="dimension_scores"
    )
    evidence: Mapped[list[Evidence]] = relationship(
        "Evidence", back_populates="dimension_score"
    )


class Evidence(Base):
    """
    Verbatim transcript span backing a dimension score.
    verified=True means EvidenceAgent confirmed the span exists in the transcript.
    """

    __tablename__ = "evidence"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    dimension_score_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("dimension_scores.id"), nullable=False
    )
    transcript_span: Mapped[str] = mapped_column(Text, nullable=False)
    start_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    end_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    dimension_score: Mapped[DimensionScore] = relationship(
        "DimensionScore", back_populates="evidence"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Override, AuditLog, ExportJob
# ─────────────────────────────────────────────────────────────────────────────


class Override(Base):
    """Human override of a score. Original AI score is never overwritten."""

    __tablename__ = "overrides"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    evaluation_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("evaluations.id"), nullable=False
    )
    dimension: Mapped[str | None] = mapped_column(Text, nullable=True)  # None = total override
    original_score: Mapped[float] = mapped_column(Float, nullable=False)
    override_score: Mapped[float] = mapped_column(Float, nullable=False)
    actor_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id"), nullable=False
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    evaluation: Mapped[Evaluation] = relationship("Evaluation", back_populates="overrides")
    actor: Mapped[User] = relationship("User", back_populates="overrides")


class AuditLog(Base):
    """Append-only audit trail for every state transition."""

    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False)
    actor_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), nullable=True)
    entity_type: Mapped[str] = mapped_column(Text, nullable=False)
    entity_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False)
    action: Mapped[str] = mapped_column(Text, nullable=False)
    before: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    after: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class ExportJob(Base):
    __tablename__ = "export_jobs"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False)
    requester_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id"), nullable=False
    )
    format: Mapped[str] = mapped_column(String(10), nullable=False)  # PDF, CSV
    scope: Mapped[str] = mapped_column(String(20), nullable=False)   # SESSION, PRESENTER
    scope_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="PENDING")
    storage_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
