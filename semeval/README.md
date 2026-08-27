# Semeval — Seminar Evaluation Platform

AI-powered multi-agent presentation scoring. Record room audio → transcribe live → evaluate against a rubric → score out of 100 with timestamped evidence, in under 20 seconds.

## One-command local start

```bash
cd semeval
cp .env.example .env          # fill in LLM and ASR API keys
make up                       # starts Postgres, Redis, MinIO, backend, worker, frontend
make migrate                  # run database migrations
```

Open **http://localhost:5173** in the browser.

Backend API docs: **http://localhost:8000/docs**  
MinIO console: **http://localhost:9001** (user: `semeval_minio`, pass: `semeval_minio_secret`)

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (with Compose v2)
- [Node.js 20+](https://nodejs.org/) (for local frontend dev without Docker)
- Optional: Python 3.12+ and `pip install -e ".[dev]"` in `backend/` for local backend dev

## Development without Docker

```bash
# Terminal 1 — Backend
cd backend
pip install -e ".[dev]"
uvicorn semeval.main:app --reload --port 8000

# Terminal 2 — Worker
cd backend
python -m semeval.workers.worker

# Terminal 3 — Frontend
cd frontend
npm install && npm run dev
```

You still need Postgres, Redis, and MinIO running (e.g. via `docker compose up db redis minio`).

## Running the test suite

```bash
# Unit tests (no external services needed)
cd backend && pytest tests/unit/ -v

# All tests (requires docker compose up)
make test
```

## Phase gate verification

```bash
make gate-0    # Phase 0: services + migrations + lint + typecheck + unit tests
```

## Environment variables

See `.env.example` for the full list with documentation.

Required for Phase 3+ (LLM evaluation):
- `OPENAI_API_KEY` — primary LLM
- `ANTHROPIC_API_KEY` — fallback LLM

Optional (Phase 2+):
- `DEEPGRAM_API_KEY` — cloud ASR (defaults to local faster-whisper)

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md).

## Scoring model

See [RUBRIC.md](./RUBRIC.md).

## Operations

See [OPERATIONS.md](./OPERATIONS.md).

## Design decisions

See [DECISIONS.md](./DECISIONS.md).
