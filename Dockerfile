FROM python:3.12-slim

# System deps for audio processing and postgres client
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    postgresql-client \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy pyproject.toml and source package
COPY semeval/backend/pyproject.toml ./
COPY semeval/backend/semeval ./semeval

RUN pip install --no-cache-dir -e ".[dev]"

COPY semeval/backend/ ./

# Non-root user for security
RUN useradd -m -u 1001 semeval && chown -R semeval:semeval /app
USER semeval

EXPOSE 8000

CMD ["sh", "-c", "uvicorn semeval.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
