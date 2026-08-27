"""
Supabase client singleton for backend use.

Uses the service-role key so it bypasses Row Level Security.
All calls are authenticated server-side — never expose the service key to the browser.
"""

from __future__ import annotations

from functools import lru_cache

import structlog
from supabase import Client, create_client

from semeval.config import get_settings

logger = structlog.get_logger(__name__)


@lru_cache(maxsize=1)
def get_supabase() -> Client:
    """Return a cached Supabase client using the service-role key."""
    s = get_settings()
    if not s.supabase_url or not s.supabase_service_role_key:
        msg = (
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. "
            "Check your .env file."
        )
        raise RuntimeError(msg)
    client = create_client(s.supabase_url, s.supabase_service_role_key)
    logger.info("supabase_client_ready", url=s.supabase_url[:40])
    return client
