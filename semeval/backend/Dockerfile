FROM python:3.12-slim

WORKDIR /app

# hatchling's editable install needs the actual package source present,
# not just pyproject.toml, so copy everything before installing.
COPY . .
RUN pip install --no-cache-dir -e .

# Non-root user for security
RUN useradd -m -u 1001 semeval && chown -R semeval:semeval /app
USER semeval

EXPOSE 8000

CMD ["sh", "-c", "uvicorn semeval.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
