"""
Sliding-window in-memory rate limiter for TDILEARNED FastAPI endpoints.
Protects Cerebras inference tokens and upstream search quotas against scraping/abuse.

Client IP resolution notes (Azure App Service):
- The app sits behind Azure ARR, which APPENDS the real client IP as the LAST
  hop of the `x-forwarded-for` chain. The leading hops are client-supplied and
  spoofable, so we must read the LAST hop — never the first.
- When the Cloudflare API gateway is in front, it forwards the real client IP
  in the trusted `x-cf-client-ip` header, which takes priority.
"""

import logging
import time
from collections import defaultdict

from fastapi import HTTPException, Request, status

logger = logging.getLogger(__name__)

# In-memory fallback: ip -> list of timestamps
_MEMORY_TIMESTAMPS: dict[str, list[float]] = defaultdict(list)


def resolve_client_ip(request: Request) -> str:
    """Return the real client IP, prioritizing trusted proxies over spoofable hops."""
    cf_ip = request.headers.get("x-cf-client-ip")
    if cf_ip:
        return cf_ip.strip()

    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        # Azure ARR appends the true client IP as the final hop.
        last_hop = forwarded.split(",")[-1].strip()
        if last_hop:
            return last_hop

    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()

    return request.client.host if request.client else "127.0.0.1"


class RateLimiter:
    def __init__(self, max_requests: int = 20, window_seconds: int = 60):
        """
        :param max_requests: Number of allowed requests in the window.
        :param window_seconds: Duration of the sliding window in seconds.
        """
        self.max_requests = max_requests
        self.window_seconds = window_seconds

    async def __call__(self, request: Request):
        client_ip = resolve_client_ip(request)

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
