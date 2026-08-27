# ── Stage 1: Build Frontend SPA ─────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY semeval/frontend ./frontend
RUN cd frontend && npm install && npm run build

# ── Stage 2: Python Backend + Unified Frontend Serving ───────────────────────
FROM python:3.12-slim

WORKDIR /app

# hatchling's editable install needs the actual package source present,
# not just pyproject.toml, so copy the whole backend dir before installing.
COPY semeval/backend/ ./
RUN pip install --no-cache-dir -e .

# Copy built frontend SPA assets from Stage 1 — served by semeval/main.py's
# static-file fallback so one service handles both the API and the UI.
COPY --from=frontend-builder /app/frontend/dist /app/frontend_dist

# Non-root user for security
RUN useradd -m -u 1001 semeval && chown -R semeval:semeval /app
USER semeval

EXPOSE 8000

CMD ["sh", "-c", "uvicorn semeval.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
