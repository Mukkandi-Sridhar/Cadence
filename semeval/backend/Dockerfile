# ── Stage 1: Build Frontend SPA ─────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY ../frontend ./frontend
COPY ../packages ./packages
RUN if [ -d "packages/shared-types" ]; then cd packages/shared-types && npm install && npm run build; fi
RUN if [ -d "frontend" ]; then cd frontend && npm install && npm run build; fi

# ── Stage 2: Python Backend ──────────────────────────────────────────────────
FROM python:3.12-slim

# System deps for audio processing and postgres client
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    postgresql-client \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first (layer cache)
COPY pyproject.toml .
RUN pip install --no-cache-dir -e ".[dev]"

# Copy source
COPY . .

# Copy built frontend assets if present in Stage 1
COPY --from=frontend-builder /app/frontend/dist /app/frontend_dist

# Non-root user for security
RUN useradd -m -u 1001 semeval && chown -R semeval:semeval /app
USER semeval

EXPOSE 8000

CMD ["sh", "-c", "uvicorn semeval.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
