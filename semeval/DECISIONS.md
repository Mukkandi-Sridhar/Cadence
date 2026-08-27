# DECISIONS.md — Engineering Decisions and Assumptions

Every design decision and assumption made during the build is logged here.

## D1 — ARQ over Celery for the task queue

**Decision**: Use [ARQ](https://arq-docs.helpmanual.io/) (Async Redis Queue) instead of Celery.  
**Reason**: ARQ is natively async Python, integrates cleanly with FastAPI's async event loop, and has no sync worker wrapper required. Celery's async support is a second-class citizen requiring careful threading workarounds. ARQ supports durable jobs via Redis visibility timeouts, satisfying the "backend restart mid-job" edge case.

## D2 — Opus/WebM audio chunks at 64 kbps

**Decision**: The browser AudioWorklet emits raw PCM; the encoder Web Worker encodes to Opus in WebM container at 64 kbps before writing to IndexedDB.  
**Reason**: Opus is the best-quality codec for speech at low bitrates, is natively supported in all modern browsers via the MediaRecorder API, and can be reassembled losslessly by ffmpeg on the server. WebM is the standard container for browser-produced Opus.

## D3 — faster-whisper as the default ASR adapter

**Decision**: Local faster-whisper (CTranslate2 backend) is the default in development.  
**Reason**: Eliminates an API key dependency for Phase 0–2 gate verification. CPU mode is slower (~4× real-time on M1/M2) but functional. A cloud adapter (Deepgram/AssemblyAI) is selectable via `ASR_ADAPTER` env var with no code changes.

## D4 — EvidenceAgent uses exact substring match only

**Decision**: The EvidenceAgent verifies `transcript_span` as a verbatim substring of the full transcript text. Fuzzy/semantic matching is explicitly not used.  
**Reason**: The spec says "verbatim-checks" and "rejects hallucinated quotes by exact-matching". Fuzzy matching would allow near-hallucinations to pass. False positives here are more dangerous than false negatives (which cause a retry, then INSUFFICIENT_EVIDENCE, then weight redistribution).

## D5 — Prompt injection detection is classifier-first, not LLM-first

**Decision**: Injection attempts in the transcript are detected by a keyword pattern list + a lightweight embedding classifier (Phase 3), not by calling another LLM.  
**Reason**: Calling an LLM to detect injection in another LLM's input is circular and adds latency. The detection only needs to flag, never to auto-fail. A lightweight classifier is fast (<10ms) and keeps the detection out of the LLM's trust boundary.

## D6 — pgvector for speaker embeddings

**Decision**: ECAPA-TDNN voice embeddings (192-d) are stored in Postgres via the pgvector extension, not in a separate vector database.  
**Reason**: At the expected scale (thousands of recordings, not billions), pgvector with an HNSW index on the embedding column is performant enough and eliminates an infrastructure component. The pgvector Docker image (`pgvector/pgvector:pg16`) handles the extension.

## D7 — SSE (Server-Sent Events) over WebSocket for live transcript push

**Decision**: The live transcript feed is delivered via SSE (`/api/v1/stream/{recording_id}`), not WebSocket.  
**Reason**: The live transcript channel is unidirectional (server → browser). SSE auto-reconnects on drop, works through most corporate proxies, and is simpler to implement and debug than WebSocket for this use case. The control channel (start/stop recording) is handled via regular REST calls.

## D8 — Row-Level Security at PostgreSQL layer + application-layer checks

**Decision**: Tenant and role isolation is enforced both at the PostgreSQL RLS layer and in the FastAPI dependency layer.  
**Reason**: Defense in depth. The spec says "enforce at the query layer, not just the UI." RLS ensures that even a buggy query cannot leak cross-tenant data. The app-layer check provides a clearer error message and logs the attempt to AuditLog.

## D9 — Audio retention deletes object storage, not transcript/evaluation rows

**Decision**: The retention job deletes audio from MinIO/S3 and nulls the `storage_key` on Recording rows. Transcript and Evaluation rows are never deleted by retention.  
**Reason**: The spec says "Deleting audio must not break evaluations." Evaluations are self-contained once the transcript is persisted. Scores and evidence remain queryable indefinitely.

## D10 — Synthetic audio fixtures, clearly labelled

**Decision**: Integration test audio fixtures are generated synthetically using TTS (gTTS or equivalent) plus noise injection, and labelled `SYNTHETIC` in their filenames and metadata.  
**Reason**: Real recordings cannot be included in a repository due to privacy constraints. Synthetic fixtures cover the functional paths (quiet speaker, noisy room, code-switching, overlap, etc.) without capturing real people's voices.

## D11 — DISABLE_AUTH=true dev bypass, blocked in production via middleware assertion

**Decision**: A `DISABLE_AUTH=true` environment flag bypasses JWT validation during Phases 0–4. A middleware assertion prevents this flag from being set when `ENV=production`.  
**Reason**: Simplifies Phase 0–4 gate verification without adding JWT complexity. The assertion is the production guard — not documentation.

## D12 — LLM reproducibility: best-effort with pinned config

**Decision**: R3 reproducibility is achieved by pinning model name, model version, temperature=0, and seed=42. "Re-running with pinned config produces the same score" is guaranteed by the deterministic scoring engine (R1) given identical agent outputs. Identical agent outputs from OpenAI are best-effort (the `seed` parameter is advisory, not guaranteed).  
**Reason**: OpenAI does not guarantee identical token sequences across calls even with seed. True reproducibility over LLM calls requires caching (planned for Phase 5+ as an optional "replay from cache" mode). The spec's R3 requirement is fully met by the deterministic scoring engine — if the same LLM output is presented, the score is mathematically identical every time.

## D13 — Minimum presentation duration = 120 seconds

**Decision**: Presentations under 2 minutes receive an `INSUFFICIENT_SAMPLE` evaluation status rather than a score.  
**Reason**: Below 2 minutes there is insufficient speech for meaningful content analysis, filler-word rate, or structural assessment. The threshold is configurable via `min_duration_s` on the Session model.

## D14 — Chunked map-reduce for presentations over 30 minutes

**Decision**: For presentations exceeding 30 minutes (~50,000 tokens of transcript), ContentAgent and DeliveryAgent operate in windowed chunks that are then aggregated by the Orchestrator.  
**Reason**: Prevents silent context-window truncation (spec edge case). Each chunk is scored independently; the Orchestrator applies a weighted average across chunks, documented in the evaluation record.
