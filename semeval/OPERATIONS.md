# OPERATIONS.md — Operations Runbook

## Starting the platform

```bash
cd semeval
cp .env.example .env   # edit keys
make up
make migrate
```

## Stopping

```bash
make down              # stops containers, preserves data volumes
make clean             # stops AND removes all data volumes (destructive)
```

## Checking service health

```bash
docker compose ps      # shows health status of all services
make logs              # tail all service logs
```

## Database

### Connect via psql
```bash
make db-shell
```

### Run migrations
```bash
make migrate
```

### Create a new migration after model changes
```bash
make migration MSG="add foo column to recordings"
```

### Rollback one migration
```bash
docker compose run --rm backend alembic downgrade -1
```

## Audio retention

The retention job (`semeval/retention/jobs.py`) runs on a configurable schedule (Phase 5).

**Configuration** (`.env`):
```
AUDIO_RETENTION_DAYS=90          # audio deleted after N days
TRANSCRIPT_RETENTION_DAYS=730    # transcripts retained longer
```

**What gets deleted**: Audio files in MinIO/S3 and the `storage_key` on Recording rows.  
**What is kept**: Transcript rows, TranscriptSegment rows, Evaluation rows, DimensionScore, Evidence, AuditLog — forever (until a presenter requests erasure).

**Manual trigger**:
```bash
docker compose run --rm worker python -m semeval.retention.jobs --dry-run
docker compose run --rm worker python -m semeval.retention.jobs --execute
```

## Encryption keys

- Audio at rest: MinIO/S3 server-side encryption (SSE-S3 or SSE-KMS in production).
- Playback URLs: Pre-signed S3 URLs with 1-hour expiry. Never log these URLs.
- JWT secret: Rotate by setting `JWT_SECRET` to a new value and restarting the backend. Existing tokens are invalidated immediately.

## Failure runbooks

### LLM evaluation stuck / job never completes
1. Check `docker compose logs worker` for error messages.
2. Check Redis job queue: `make redis-cli` → `KEYS arq:*`.
3. Jobs have a visibility timeout of `QUEUE_VISIBILITY_TIMEOUT_S` (default 300s). After expiry, the job is re-queued automatically.
4. To manually retry: POST `/api/v1/evaluations/{id}/retry`.
5. If LLM is down, check `LLM_FALLBACK_MODEL` is configured.

### Backend out of disk space
The backend does not write audio to local disk — audio goes directly from the browser to MinIO. If the MinIO container's volume fills up:
1. `docker compose exec minio mc admin info local` to see usage.
2. Run the retention job manually (see above).
3. Resize the MinIO volume or move to a larger host.

### Postgres connection exhaustion
The backend uses a pool of 10 connections with 20 overflow. If this is hit:
1. Check for stuck long-running queries: `SELECT * FROM pg_stat_activity WHERE state != 'idle';`
2. Kill stuck queries: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE ...;`
3. Increase `pool_size` in `semeval/db/base.py` and redeploy.

### Audio chunk upload fails repeatedly
The browser uploader retries with exponential backoff (1s, 2s, 4s, ..., max 60s). After 10 retries without success, the session is marked "pending upload" and the upload resumes when connectivity returns.
1. Check MinIO health: `docker compose ps minio`.
2. Check MinIO logs: `docker compose logs minio`.
3. Chunks are durably stored in IndexedDB — they will not be lost even if the browser tab is closed.

### Score is disputed by the presenter
1. The full evidence trail is visible in the Results screen (Screen 4).
2. Every sub-score has at least one verbatim transcript quote with a timestamp.
3. To reproduce: GET `/api/v1/evaluations/{id}` — includes `model_name`, `model_version`, `prompt_hash`, `temperature`, `seed`.
4. Re-score with the same config: POST `/api/v1/evaluations/{id}/retry` with `use_pinned_config=true`.
5. An evaluator can override any dimension score via the Override panel; the override creates a new row and never mutates the AI score.

## Data export and erasure

### Presenter exports their own data
POST `/api/v1/presenters/{id}/export` → returns a signed download URL for a ZIP of:
- Their transcript
- Their evaluation with all evidence
- The audio recording (if not yet deleted by retention)

### Presenter requests erasure
POST `/api/v1/presenters/{id}/erasure-request`  
This schedules:
1. Immediate deletion of audio from object storage.
2. Anonymisation of TranscriptSegment text (replaced with `[REDACTED]`).
3. Soft-delete of the Presenter row.
4. AuditLog entry with actor and timestamp.

Evaluation and DimensionScore rows are retained (no PII) to preserve statistical integrity of the session.

## Access control (RBAC)

| Role | Can see | Can do |
|---|---|---|
| admin | All tenants | Everything |
| organizer | Their events and sessions | Create sessions, view all results in their events |
| evaluator | Sessions they are assigned to | Override scores |
| presenter | Only their own results | View, export, request erasure |
| viewer | Sessions they are invited to | View only |

Enforced at the query layer (RLS + FastAPI dependency). UI restrictions are additional.

## Monitoring

Phase 0 ships with structured JSON logs via `structlog`. In production:
- Ship logs to your log aggregator (Datadog, Loki, etc.) by setting the log driver on Docker services.
- Key log events: `evaluation_complete`, `evaluation_failed`, `chunk_upload_gap`, `identity_flag`, `injection_attempt_detected`, `calibration_drift_flagged`.
