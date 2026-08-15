"""
SSE adapter for the map-reduce research graph.

Runs the LangGraph research workflow and streams its real events
(plan, thought, tool_call, tool_result, source, node_stream, dossier, done)
over Server-Sent Events to the frontend.
"""

import asyncio
import json
import logging
from collections.abc import AsyncGenerator
from typing import Any

from app.services.research_graph import EventSink, run_research_graph

logger = logging.getLogger(__name__)

DOSSIER_STORE: dict[str, dict] = {}


def emit_sse(event_type: str, data: Any) -> str:
    payload = json.dumps({"event": event_type, "data": data})
    return f"data: {payload}\n\n"


async def stream_deep_research(
    topic: str,
    category: str | None = None,
    parent_id: str | None = None,
    context_chain: list[str] | None = None,
    image_query: str | None = None,
) -> AsyncGenerator[str, None]:
    """Run the research graph and stream its events as SSE."""
    queue: asyncio.Queue = asyncio.Queue()
    sink = EventSink(queue)

    task = asyncio.create_task(
        run_research_graph(
            topic=topic,
            category=category,
            parent_id=parent_id,
            context_chain=context_chain,
            image_query=image_query,
            sink=sink,
        )
    )

    try:
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=0.25)
            except TimeoutError:
                if task.done():
                    break
                continue

            if event.get("event") == "done":
                # Capture dossier for the /research/dossier/{id} endpoint.
                yield emit_sse(event["event"], event["data"])
                # Wait for the graph task to fully finish, then drain remaining.
                await task
                while not queue.empty():
                    leftover = queue.get_nowait()
                    if leftover.get("event") not in ("done",):
                        yield emit_sse(leftover["event"], leftover["data"])
                break

            # Persist dossiers emitted by the graph so they can be retrieved later.
            if event.get("event") == "dossier":
                node_id = event["data"].get("node_id")
                if node_id:
                    DOSSIER_STORE[node_id] = event["data"].get("dossier", {})

            yield emit_sse(event["event"], event["data"])
    finally:
        if not task.done():
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
