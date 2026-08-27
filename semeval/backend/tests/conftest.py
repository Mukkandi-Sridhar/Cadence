"""
Pytest configuration and shared fixtures.

Unit tests in tests/unit/ do not require any external services.
Integration tests in tests/integration/ require docker compose up.
"""

from __future__ import annotations

import os

import pytest

# ── Set test environment before any imports ───────────────────────────────────
os.environ.setdefault("DISABLE_AUTH", "true")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://semeval:semeval_test_secret@localhost:5432/semeval_test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/1")
os.environ.setdefault("STORAGE_ENDPOINT", "http://localhost:9000")
os.environ.setdefault("STORAGE_ACCESS_KEY", "minioadmin")
os.environ.setdefault("STORAGE_SECRET_KEY", "minioadmin")
os.environ.setdefault("STORAGE_BUCKET", "semeval-test")
os.environ.setdefault("LLM_TEMPERATURE", "0")
os.environ.setdefault("LLM_SEED", "42")


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"
