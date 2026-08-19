"""SSE heartbeat helper tests."""

import asyncio

from app.services.sse import emit_sse, with_heartbeat


async def _events(generator: object) -> list[str]:
    return [chunk async for chunk in generator]


async def test_heartbeat_emitted_when_generator_silent():
    async def slow_inner():
        yield "data: first\n\n"
        await asyncio.sleep(0.5)
        yield "data: second\n\n"

    chunks = await _events(with_heartbeat(slow_inner(), interval_s=0.1))
    assert chunks[0] == "data: first\n\n"
    assert any(chunk.startswith('data: {"event": "heartbeat"') for chunk in chunks)
    assert chunks[-1] == "data: second\n\n"


async def test_no_heartbeat_when_events_flow_fast():
    async def fast_inner():
        for i in range(3):
            yield emit_sse("chunk", {"n": i})

    chunks = await _events(with_heartbeat(fast_inner(), interval_s=10.0))
    assert len(chunks) == 3
    assert all(not c.startswith('data: {"event": "heartbeat"') for c in chunks)


async def test_generator_not_cancelled_by_heartbeat():
    """The wrapped generator must keep running after a heartbeat fires."""

    async def inner():
        yield emit_sse("thought", {"text": "thinking"})
        await asyncio.sleep(0.3)
        yield emit_sse("done", {})

    chunks = await _events(with_heartbeat(inner(), interval_s=0.05))
    assert any(c.startswith('data: {"event": "heartbeat"') for c in chunks)
    assert chunks[-1] == emit_sse("done", {})


async def test_terminates_on_stop_iteration():
    async def empty():
        return
        yield  # pragma: no cover

    chunks = await _events(with_heartbeat(empty(), interval_s=0.01))
    assert chunks == []
