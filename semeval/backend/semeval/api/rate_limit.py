"""
Per-IP rate limiting for endpoints that trigger a paid OpenAI call.

Before this, /transcribe and /score were open to anyone who found the URL —
with DISABLE_AUTH defaulting true and no limiter, each hit is a real,
unbounded charge against the OpenAI account. This caps abuse without
requiring auth to be turned on.

In-memory sliding window, correct for this app's single-instance deployment
(WEB_CONCURRENCY=1 — see the root Dockerfile). Would need a shared store
(e.g. Redis) if this ever scales to multiple instances, since each instance
would otherwise track its own independent window.
"""

from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

from semeval.config import get_settings

_hits: dict[str, deque[float]] = defaultdict(deque)


def _check_rate_limit(
    key: str, max_requests: int, window_s: float, now: float
) -> float | None:
    """Returns None if the request is allowed, else seconds until it isn't rate-limited."""
    window = _hits[key]
    while window and now - window[0] > window_s:
        window.popleft()
    if len(window) >= max_requests:
        return max(1.0, window_s - (now - window[0]))
    window.append(now)
    return None


def rate_limit_costly_endpoint(request: Request) -> None:
    settings = get_settings()
    client_ip = request.client.host if request.client else "unknown"
    retry_after = _check_rate_limit(
        key=client_ip,
        max_requests=settings.rate_limit_requests,
        window_s=settings.rate_limit_window_s,
        now=time.monotonic(),
    )
    if retry_after is not None:
        raise HTTPException(
            status_code=429,
            detail=f"Too many requests — try again in {int(retry_after)}s.",
            headers={"Retry-After": str(int(retry_after))},
        )
