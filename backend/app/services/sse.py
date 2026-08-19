"""Shared Server-Sent Events helpers with idle heartbeat support.

Long-running research/chat streams can legitimately go quiet for tens of
seconds while the LLM synthesizes (especially on slow fallback providers).
Without heartbeats the client watchdog treats a slow-but-healthy stream as
dead and silently closes it. `with_heartbeat` emits a `heartbeat` event
whenever the wrapped generator has produced nothing for `interval_s`, so the
client can distinguish "still working" from "connection lost".
"""

import asyncio
import json
import time
from collections.abc import AsyncGenerator, AsyncIterator, Coroutine
from typing import Any, cast

HEARTBEAT_INTERVAL_S = 15.0


def emit_sse(event_type: str, data: Any) -> str:
    payload = json.dumps({"event": event_type, "data": data})
    return f"data: {payload}\n\n"


async def with_heartbeat(
    inner: AsyncIterator[str],
    interval_s: float = HEARTBEAT_INTERVAL_S,
) -> AsyncGenerator[str, None]:
    """Yield events from `inner`, emitting a heartbeat when it stays quiet.

    The wrapped generator is never cancelled: if it is still awaiting a slow
    LLM call when `interval_s` elapses, we emit a heartbeat and keep waiting.
    """
    next_task: asyncio.Task | None = None
    while True:
        if next_task is None or next_task.done():
            next_task = asyncio.create_task(cast(Coroutine[Any, Any, str], anext(inner)))
            if next_task.done():
                # First anext completed synchronously (or errored instantly).
                try:
                    yield next_task.result()
                except StopAsyncIteration:
                    return
                continue

        done, _ = await asyncio.wait({next_task}, timeout=interval_s)
        if not done:
            yield emit_sse("heartbeat", {"ts": time.time()})
            continue

        try:
            event = next_task.result()
        except StopAsyncIteration:
            return
        yield event