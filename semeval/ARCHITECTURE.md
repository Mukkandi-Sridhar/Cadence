# ARCHITECTURE.md — System Architecture

## Overview

Semeval is a multi-agent AI seminar evaluation platform. Audio recorded in a room is transcribed live, analysed by a team of specialised agents, and scored deterministically against a versioned rubric. The final score out of 100 is produced by pure arithmetic — never by the LLM.

## Data Flow

```
Browser AudioWorklet
  → encode (Web Worker, Opus/WebM)
  → IndexedDB (local durable storage, R4)
  → HTTP upload (resumable, idempotent on recording_id+seq, R4/R5)
  → MinIO / S3 (object storage)
  → Redis queue (ARQ job)
  → Orchestrator
    ├─ AudioHealthAgent (DSP)
    ├─ TranscriptionAgent (ASR adapter)
    ├─ DiarizationAgent (speaker embeddings)
    ├─ IdentityAgent (enrollment comparison)
    ├─ ContentAgent (LLM → schema validated)
    ├─ DeliveryAgent (code metrics + LLM interpretation)
    ├─ QnAAgent (LLM → schema validated, skippable)
    ├─ EvidenceAgent (verbatim verification, R2)
    ├─ RubricAgent (weight redistribution)
    ├─ CalibrationAgent (drift detection)
    └─ ReportAgent (LLM → schema validated)
  → Scoring Engine (deterministic, R1)
  → Postgres (evaluation record, dimension scores, evidence rows)
  → SSE push → Browser
```

## Component Contracts

### Agent Base Contract
Every agent:
- Accepts a typed input (pydantic model)
- Emits a typed output that passes `jsonschema` validation (R6)
- Carries model_name, model_version, prompt_hash, temperature, seed on every LLM call (R3)
- Returns at least one `Evidence` object per sub-score (R2)
- Is retried once on schema validation failure; on second failure the dimension is marked INSUFFICIENT_EVIDENCE

### Evidence Object (R2)
```json
{
  "transcript_span": "verbatim text from transcript",
  "start_ms": 42000,
  "end_ms": 47500,
  "reason": "Presenter covered X clearly."
}
```
EvidenceAgent does a Python `transcript_span in full_transcript_text` check. Any evidence that fails is rejected.

### Scoring Engine Contract (R1)
Input: `List[DimensionInput]` where each has `weight`, `raw_sub_score (0-5)`, `status`
Output: `ScoringResult` with `total_score (int, 0-100)` and per-dimension breakdown
The LLM never touches this function.

### LLM Client Contract
- Provider-agnostic adapter interface
- Primary model configurable; fallback model on 5xx / rate-limit / timeout
- Temperature=0, seed pinned per session (R3)
- All outputs schema-validated via `jsonschema` (R6)
- Retry on parse failure with repair instruction; fail dimension only (not evaluation)
- Transcript wrapped in delimited block (`<transcript>...</transcript>`); prompt asserts it is data-only (prompt injection guard)

### ASR Adapter Interface
```python
class ASRAdapter(Protocol):
    async def transcribe_stream(self, audio_stream: AsyncIterable[bytes], ...) -> AsyncIterable[TranscriptSegment]: ...
    async def transcribe_file(self, audio_path: str, ...) -> list[TranscriptSegment]: ...
```
Two implementations: `FasterWhisperAdapter` (local) and `CloudASRAdapter` (Deepgram/AssemblyAI).

## Database

PostgreSQL 16 with pgvector extension.
16 tables: Tenant, User, Rubric, RubricVersion, Event, Session, Presenter, VoiceEnrollment, Recording, AudioChunk, Transcript, TranscriptSegment, AgentRun, Evaluation, DimensionScore, Evidence, Override, AuditLog, ExportJob.

Key constraints:
- `UNIQUE(recording_id, seq)` on AudioChunk → idempotent chunk upserts
- Evaluations are append-only
- Rubric versions are immutable once created
- Soft deletes everywhere; hard delete only via retention job

Row-Level Security enforces tenant isolation at the database layer.

## Frontend

React 18 + TypeScript + Vite + Tailwind CSS (dark mode default).
State: Zustand stores (session, recording, evaluation).
Audio pipeline:
1. AudioWorklet (audio thread) → PCM samples
2. Web Worker (encoder) → Opus/WebM chunks
3. Web Worker (uploader) → IndexedDB → HTTP (with exponential backoff)

Live transcript arrives via SSE (`/api/v1/stream/{recording_id}`).

## Infrastructure (dev)

| Service | Image | Port |
|---|---|---|
| Postgres 16 + pgvector | pgvector/pgvector:pg16 | 5432 |
| Redis 7 | redis:7-alpine | 6379 |
| MinIO | minio/minio:latest | 9000 (API), 9001 (console) |
| Backend API | local build | 8000 |
| Worker | local build | — |
| Frontend | local build | 5173 |

## Reproducibility (R3)

Each Evaluation row stores: `model_name`, `model_version`, `prompt_hash` (SHA256 of the prompt template), `temperature`, `seed`.
Each AgentRun row additionally stores `input_hash` (SHA256 of the agent's input).
Re-scoring with identical pinned config through the deterministic scoring engine produces the same score if the LLM produces the same output.

## Performance Targets

| Metric | Target | Instrumented |
|---|---|---|
| Time to first partial transcript | < 2s from speech | Phase 2 |
| Live transcript lag | < 3s | Phase 2 |
| Final score (15-min talk, p50) | < 20s | Phase 3 |
| Final score (15-min talk, p95) | < 45s | Phase 3 |
| Recorder UI frame rate | 60fps | Phase 1 |
| Chunk write to IndexedDB | < 250ms | Phase 1 |
