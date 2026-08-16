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

from app.services.cache import cache_service
from app.services.research_graph import EventSink, run_research_graph

logger = logging.getLogger(__name__)

DOSSIER_TTL_SECONDS = 7 * 86400  # keep dossiers for a week


def _dossier_key(node_id: str) -> str:
    return f"dossier:{node_id}"


def get_dossier(node_id: str) -> dict | None:
    """Retrieve a dossier by node id from the persistent cache."""
    val = cache_service.get(_dossier_key(node_id))
    return val if isinstance(val, dict) else None


def emit_sse(event_type: str, data: Any) -> str:
    payload = json.dumps({"event": event_type, "data": data})
    return f"data: {payload}\n\n"


async def stream_deep_research(
    topic: str,
    category: str | None = None,
    parent_id: str | None = None,
    context_chain: list[str] | None = None,
    parent_summary: str | None = None,
    teaser_context: str | None = None,
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
            parent_summary=parent_summary,
            teaser_context=teaser_context,
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
                    # Surface a graph exception if the run died mid-stream.
                    exc = task.exception() if not task.cancelled() else None
                    if exc is not None:
                        logger.error(f"Research graph failed: {exc}")
                        yield emit_sse("error", {"message": f"Research run failed: {exc}"})
                    break
                continue

            if event.get("event") == "done":
                # Wait for the graph task to fully finish, then drain any remaining events first.
                await task
                while not queue.empty():
                    leftover = queue.get_nowait()
                    if leftover.get("event") == "dossier":
                        node_id = leftover["data"].get("node_id") or leftover["data"].get("nodeId")
                        dossier = leftover["data"].get("dossier", leftover["data"])
                        if node_id:
                            cache_service.set(_dossier_key(node_id), dossier, ttl_seconds=DOSSIER_TTL_SECONDS)
                    if leftover.get("event") not in ("done",):
                        yield emit_sse(leftover["event"], leftover["data"])
                # Yield done as the absolute last event
                yield emit_sse(event["event"], event["data"])
                break

            # Persist dossiers emitted by the graph so they can be retrieved later.
            if event.get("event") == "dossier":
                node_id = event["data"].get("node_id") or event["data"].get("nodeId")
                dossier = event["data"].get("dossier", event["data"])
                if node_id:
                    cache_service.set(_dossier_key(node_id), dossier, ttl_seconds=DOSSIER_TTL_SECONDS)

            yield emit_sse(event["event"], event["data"])
    finally:
        # Client disconnected (generator cancelled) or the run ended: always
        # make sure the background graph task is not left running.
        if not task.done():
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        else:
            # Re-raise graph failures so they are logged, not silently swallowed.
            exc = task.exception() if not task.cancelled() else None
            if exc is not None:
                logger.error(f"Research graph task raised: {exc}")
