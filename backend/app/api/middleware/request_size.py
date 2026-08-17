"""
Request size guard middleware.

Rejects oversized URLs and request bodies before they reach handlers,
preventing token-burning payloads and memory-exhaustion abuse.
"""

import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)

MAX_URL_BYTES = 8192
MAX_BODY_BYTES = 8192


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        url_bytes = len(request.url.path.encode("utf-8", errors="ignore")) + len(
            request.url.query.encode("utf-8", errors="ignore")
        )
        if url_bytes > MAX_URL_BYTES:
            return JSONResponse(
                status_code=413,
                content={"detail": "Request URL is too large."},
            )

        content_length = request.headers.get("content-length")
        if content_length and content_length.isdigit() and int(content_length) > MAX_BODY_BYTES:
            return JSONResponse(
                status_code=413,
                content={"detail": "Request body is too large."},
            )

        return await call_next(request)
