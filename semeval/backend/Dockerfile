FROM python:3.12-slim

# build-essential: some pinned deps (numpy/scipy) may need to compile on
# platforms without a prebuilt wheel.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first (layer cache)
COPY pyproject.toml .
RUN pip install --no-cache-dir -e .

# Copy source
COPY . .

# Non-root user for security
RUN useradd -m -u 1001 semeval && chown -R semeval:semeval /app
USER semeval

EXPOSE 8000

CMD ["sh", "-c", "uvicorn semeval.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
