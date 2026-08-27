"""
Pydantic API request and response schemas.
Covers sessions, recordings, chunks, evaluations, overrides, and exports.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

# ── Session Schemas ─────────────────────────────────────────────────────────


class SessionCreate(BaseModel):
    event_id: str
    rubric_version_id: str
    topic: str = Field(..., min_length=3, max_length=500)
    coverage_points: list[str] = Field(default_factory=list, min_length=1)
    target_duration_s: int = Field(..., ge=30, le=7200)
    grace_period_s: int = Field(default=60, ge=0, le=300)
    min_duration_s: int = Field(default=120, ge=30, le=600)
    presenter_names: list[str] = Field(default_factory=list, min_length=1)


class PresenterResponse(BaseModel):
    id: str
    session_id: str
    name: str
    queue_order: int
    status: Literal["QUEUED", "RECORDING", "SCORED", "SKIPPED"]
    created_at: datetime


class SessionResponse(BaseModel):
    id: str
    event_id: str
    rubric_version_id: str
    topic: str
    coverage_points: list[str]
    target_duration_s: int
    grace_period_s: int
    min_duration_s: int
    consent_recorded: bool
    status: Literal["PENDING", "RECORDING", "EVALUATING", "COMPLETE", "FAILED"]
    created_at: datetime
    presenters: list[PresenterResponse] = Field(default_factory=list)


class ConsentRequest(BaseModel):
    consent_given: bool


# ── Recording & Chunk Schemas ────────────────────────────────────────────────


class RecordingStartRequest(BaseModel):
    presenter_id: str
    device_id: str | None = None


class RecordingResponse(BaseModel):
    id: str
    presenter_id: str
    session_id: str
    status: Literal["RECORDING", "COMPLETE", "PROCESSING", "FAILED"]
    started_at: datetime | None = None
    stopped_at: datetime | None = None
    duration_ms: int | None = None
    storage_key: str | None = None


class ChunkUploadResponse(BaseModel):
    chunk_id: str
    recording_id: str
    seq: int
    byte_size: int
    sha256: str
    uploaded_at: datetime


# ── Evaluation & Evidence Schemas ────────────────────────────────────────────


class EvidenceResponse(BaseModel):
    id: str
    transcript_span: str
    start_ms: int
    end_ms: int
    reason: str
    verified: bool


class DimensionScoreResponse(BaseModel):
    id: str
    dimension: str
    weight: float
    raw_sub_score: float | None
    scaled_score: float | None
    status: Literal["SCORED", "SKIPPED", "INSUFFICIENT_EVIDENCE", "LOW_CONFIDENCE"]
    model_used: str | None
    evidence: list[EvidenceResponse] = Field(default_factory=list)


class EvaluationResponse(BaseModel):
    id: str
    recording_id: str
    presenter_id: str
    rubric_version_id: str
    model_name: str
    model_version: str
    prompt_hash: str
    temperature: float
    seed: int | None
    total_score: int | None
    status: Literal[
        "PENDING", "RUNNING", "COMPLETE", "FAILED", "LOW_CONFIDENCE", "INSUFFICIENT_SAMPLE"
    ]
    audio_quality: str | None
    created_at: datetime
    dimension_scores: list[DimensionScoreResponse] = Field(default_factory=list)
    strengths: list[dict[str, Any]] = Field(default_factory=list)
    improvements: list[dict[str, Any]] = Field(default_factory=list)


class ScoreOverrideRequest(BaseModel):
    dimension: str | None = None  # None = total score override
    override_score: float = Field(..., ge=0, le=100)
    reason: str = Field(..., min_length=10, max_length=1000)


class OverrideResponse(BaseModel):
    id: str
    evaluation_id: str
    dimension: str | None
    original_score: float
    override_score: float
    actor_id: str
    reason: str
    created_at: datetime


# ── Export & Calibration Schemas ─────────────────────────────────────────────


class ExportRequest(BaseModel):
    format: Literal["PDF", "CSV"]
    scope: Literal["SESSION", "PRESENTER"]
    scope_id: str


class ExportJobResponse(BaseModel):
    id: str
    tenant_id: str
    requester_id: str
    format: str
    scope: str
    scope_id: str
    status: Literal["PENDING", "RUNNING", "COMPLETE", "FAILED"]
    download_url: str | None = None
    created_at: datetime
