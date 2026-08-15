"""
Offline batch precompute of fully-researched discovery hubs.

Runs the map-reduce research graph headlessly on topics picked by the
curiosity picker, captures the emitted root node + child branches + dossier,
and persists each as a PrecomputedHub so the frontend can render an instant
"already-explored" canvas without waiting on live research.
"""

import asyncio
import logging
import os
import time
import uuid
from collections.abc import Sequence
from typing import Any

from app.schemas.graph import NodeSchema, PrecomputedHubSchema, PrecomputedHubSummarySchema
from app.services.cache import cache_service
from app.services.random_topic import CATEGORY_WIKI_MAP, pick_random_topic
from app.services.research_agent import _dossier_key
from app.services.research_graph import EventSink, run_research_graph

logger = logging.getLogger(__name__)

# Batch precompute runs on Mistral (cheap, no TTFT requirement); live research
# and chat stay on Cerebras. Override with PRECOMPUTE_ENGINE if needed.
PRECOMPUTE_ENGINE = os.getenv("PRECOMPUTE_ENGINE", "mistral")

# Hubs persist for 30 days; the index refreshes with each batch run.
HUB_TTL_SECONDS = 30 * 86400
INDEX_KEY = "precomputed:index"


def _hub_key(hub_id: str) -> str:
    return f"precomputed:hub:{hub_id}"


def list_precomputed_hubs() -> list[dict[str, Any]]:
    """Return the cached index of precomputed hubs (newest first)."""
    val = cache_service.get(INDEX_KEY)
    return val if isinstance(val, list) else []


def get_precomputed_hub(hub_id: str) -> PrecomputedHubSchema | None:
    val = cache_service.get(_hub_key(hub_id))
    if not isinstance(val, dict):
        return None
    try:
        return PrecomputedHubSchema(**val)
    except Exception as e:
        logger.warning(f"Corrupt precomputed hub {hub_id}: {e}")
        return None


def _dossier_from_events(events: list[dict[str, Any]]) -> dict | None:
    for ev in events:
        if ev.get("event") == "dossier":
            return ev.get("data", {}).get("dossier")
    return None


def _node_streams(events: list[dict[str, Any]]) -> list[tuple[dict, bool]]:
    """Return (node dict, is_root) pairs in emission order."""
    out = []
    for ev in events:
        if ev.get("event") == "node_stream":
            out.append((ev["data"]["node"], bool(ev["data"].get("is_root"))))
    return out


async def precompute_one(category: str) -> PrecomputedHubSchema | None:
    """Pick a topic in `category` and fully research it into a persisted hub."""
    started = time.time()
    try:
        picked = await pick_random_topic(category)
    except Exception as e:
        logger.warning(f"[precompute] topic pick failed for {category}: {e}")
        return None

    topic = picked.node.title
    logger.info(f"[precompute] researching '{topic}' ({category}) on {PRECOMPUTE_ENGINE}...")

    queue: asyncio.Queue = asyncio.Queue()
    sink = EventSink(queue)
    try:
        await run_research_graph(topic=topic, category=category, sink=sink, engine=PRECOMPUTE_ENGINE)
    except Exception as e:
        logger.warning(f"[precompute] research graph failed for '{topic}': {e}")
        return None

    events: list[dict[str, Any]] = []
    while not queue.empty():
        events.append(queue.get_nowait())

    streams = _node_streams(events)
    if not streams:
        logger.warning(f"[precompute] no nodes emitted for '{topic}'")
        return None

    root_node = next((n for n, is_root in streams if is_root), streams[0][0])
    children = [n for n, is_root in streams if not is_root]

    hub = PrecomputedHubSchema(
        id=str(uuid.uuid4())[:8],
        topic=topic,
        category=category,
        root=NodeSchema(**root_node),
        children=[NodeSchema(**c) for c in children],
    )

    cache_service.set(_hub_key(hub.id), hub.model_dump(), ttl_seconds=HUB_TTL_SECONDS)

    dossier = _dossier_from_events(events)
    if dossier:
        cache_service.set(_dossier_key(root_node["id"]), dossier, ttl_seconds=HUB_TTL_SECONDS)

    logger.info(f"[precompute] '{topic}' -> hub {hub.id} ({len(children)} branches) in {time.time() - started:.1f}s")
    return hub


async def precompute_batch(categories: Sequence[str] | None = None) -> list[PrecomputedHubSummarySchema]:
    """Run a batch of hub precomputations, one per category, updating the index."""
    cats = [c for c in (categories or list(CATEGORY_WIKI_MAP.keys())) if c in CATEGORY_WIKI_MAP]
    if not cats:
        cats = list(CATEGORY_WIKI_MAP.keys())

    # Current index (already-researched hubs) merged with this batch, deduped by topic.
    existing: list[dict[str, Any]] = list_precomputed_hubs()
    seen_topics = {e.get("topic") for e in existing}

    summaries: list[PrecomputedHubSummarySchema] = []
    for cat in cats:
        hub = await precompute_one(cat)
        if hub is None:
            continue
        if hub.topic in seen_topics:
            continue
        seen_topics.add(hub.topic)
        summaries.append(
            PrecomputedHubSummarySchema(
                id=hub.id,
                topic=hub.topic,
                category=hub.category,
                imageUrl=hub.root.imageUrl,
                summary=(hub.root.summary or "")[:160],
            )
        )

    merged = [s.model_dump() for s in summaries] + existing
    cache_service.set(INDEX_KEY, merged, ttl_seconds=HUB_TTL_SECONDS)
    return summaries
