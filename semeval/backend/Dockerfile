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

# Non-root user for security
RUN useradd -m -u 1001 semeval && chown -R semeval:semeval /app
USER semeval

EXPOSE 8000
