"""
Sliding-window in-memory rate limiter for TDILEARNED FastAPI endpoints.
Protects Cerebras inference tokens and upstream search quotas against scraping/abuse.
"""

import logging
import time
from collections import defaultdict

from fastapi import HTTPException, Request, status

logger = logging.getLogger(__name__)

# In-memory fallback: ip -> list of timestamps
_MEMORY_TIMESTAMPS: dict[str, list[float]] = defaultdict(list)


class RateLimiter:
    def __init__(self, max_requests: int = 20, window_seconds: int = 60):
        """
        :param max_requests: Number of allowed requests in the window.
        :param window_seconds: Duration of the sliding window in seconds.
        """
        self.max_requests = max_requests
        self.window_seconds = window_seconds

    async def __call__(self, request: Request):
        # Determine client IP (handles reverse proxies on Azure Container Apps)
        client_ip = (
            request.headers.get("x-forwarded-for", "").split(",")[0].strip()
            or request.headers.get("x-real-ip")
            or (request.client.host if request.client else "127.0.0.1")
        )

        now = time.time()
        key = f"ratelimit:{request.url.path}:{client_ip}"

        cutoff = now - self.window_seconds
        timestamps = _MEMORY_TIMESTAMPS[key]
        # Prune old timestamps
        _MEMORY_TIMESTAMPS[key] = [t for t in timestamps if t > cutoff]
        _MEMORY_TIMESTAMPS[key].append(now)

        if len(_MEMORY_TIMESTAMPS[key]) > self.max_requests:
            retry_after = int(self.window_seconds)
            logger.warning(
                f"Rate limit exceeded for IP {client_ip} on {request.url.path} ({len(_MEMORY_TIMESTAMPS[key])}/{self.max_requests})"
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "error": "Rate limit exceeded",
                    "message": f"Too many requests. Please wait {retry_after} seconds.",
                    "retry_after": retry_after,
                },
                headers={"Retry-After": str(retry_after)},
            )


# Default endpoint rate limiters
research_rate_limiter = RateLimiter(max_requests=15, window_seconds=60)
chat_rate_limiter = RateLimiter(max_requests=30, window_seconds=60)
general_rate_limiter = RateLimiter(max_requests=60, window_seconds=60)
