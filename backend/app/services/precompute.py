"""
Offline batch precompute of fully-researched discovery hubs.

Runs the map-reduce research graph headlessly — on topics picked by the
curiosity picker, or on hundreds of topics bulk-sourced from the deep-crawl
catalog — captures the emitted root node + child branches + dossier, and
persists each as a PrecomputedHub so the frontend can render an instant
"already-explored" canvas without waiting on live research.
"""

import asyncio
import logging
import os
import random
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
PRECOMPUTE_CONCURRENCY = int(os.getenv("PRECOMPUTE_CONCURRENCY", "4"))

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


def _append_index(entry: dict[str, Any]) -> None:
    """Crash-safe index update: append a hub summary, dedup by topic, persist."""
    current = list_precomputed_hubs()
    topics = {e.get("topic") for e in current}
    if entry.get("topic") in topics:
        return
    cache_service.set(INDEX_KEY, [entry, *current], ttl_seconds=HUB_TTL_SECONDS)


async def precompute_topic(topic: str, category: str) -> PrecomputedHubSchema | None:
    """Fully research a specific topic into a persisted hub (used by bulk runs)."""
    started = time.time()
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


async def precompute_one(category: str) -> PrecomputedHubSchema | None:
    """Pick a topic in `category` and fully research it into a persisted hub."""
    try:
        picked = await pick_random_topic(category)
    except Exception as e:
        logger.warning(f"[precompute] topic pick failed for {category}: {e}")
        return None
    return await precompute_topic(picked.node.title, category)


def _catalog_topics(categories: Sequence[str]) -> list[tuple[str, str]]:
    """Load (topic, category) pairs from the cached deep-crawl catalog pools.

    No network, no picker LLM: the pools were already harvested (200/category).
    Returns round-robin interleaved so every category is represented early.
    """
    by_cat: dict[str, list[tuple[str, str]]] = {}
    for cat in categories:
        pool = cache_service.get(f"topics:catalog:{cat.lower()}")
        if isinstance(pool, list):
            by_cat[cat] = [(str(item.get("title") or "").strip(), cat) for item in pool if item.get("title")]
        else:
            by_cat[cat] = []

    topics: list[tuple[str, str]] = []
    max_len = max((len(v) for v in by_cat.values()), default=0)
    for i in range(max_len):
        for cat in categories:
            items = by_cat.get(cat, [])
            if i < len(items):
                topics.append(items[i])
    return topics


async def precompute_bulk(
    count: int = 500,
    concurrency: int | None = None,
    categories: Sequence[str] | None = None,
) -> list[PrecomputedHubSchema]:
    """Research `count` catalog topics into fully-precomputed hubs, concurrently.

    Sources topics from the cached deep-crawl pools (round-robin across
    categories), skips topics already hub-researched, and persists each hub +
    dossier + index entry as it completes so progress survives interruptions.
    """
    concurrency = concurrency or PRECOMPUTE_CONCURRENCY
    cats = [c for c in (categories or list(CATEGORY_WIKI_MAP.keys())) if c in CATEGORY_WIKI_MAP]
    if not cats:
        cats = list(CATEGORY_WIKI_MAP.keys())

    existing_topics = {(e.get("topic") or "").strip().lower() for e in list_precomputed_hubs()}
    queue = [(t, c) for t, c in _catalog_topics(cats) if t.lower() not in existing_topics]
    random.shuffle(queue)
    queue = queue[:count]

    started = time.time()
    semaphore = asyncio.Semaphore(concurrency)
    completed: list[PrecomputedHubSchema] = []

    async def _worker(topic: str, category: str) -> None:
        async with semaphore:
            hub = await precompute_topic(topic, category)
        if hub is None:
            return
        completed.append(hub)
        _append_index(
            PrecomputedHubSummarySchema(
                id=hub.id,
                topic=hub.topic,
                category=hub.category,
                imageUrl=hub.root.imageUrl,
                summary=(hub.root.summary or "")[:160],
            ).model_dump()
        )
        done = len(completed)
        if done % 10 == 0 or done == len(queue):
            logger.info(
                f"[precompute] progress {done}/{len(queue)} hubs "
                f"({(time.time() - started) / max(done, 1) * (len(queue) - done):.0f}s remaining)"
            )

    await asyncio.gather(*(_worker(t, c) for t, c in queue))
    logger.info(f"[precompute] bulk done: {len(completed)}/{len(queue)} hubs in {time.time() - started:.0f}s")
    return completed


async def precompute_batch(categories: Sequence[str] | None = None) -> list[PrecomputedHubSummarySchema]:
    """Run a batch of hub precomputations, one per category, updating the index."""
    cats = [c for c in (categories or list(CATEGORY_WIKI_MAP.keys())) if c in CATEGORY_WIKI_MAP]
    if not cats:
        cats = list(CATEGORY_WIKI_MAP.keys())

    summaries: list[PrecomputedHubSummarySchema] = []
    for cat in cats:
        hub = await precompute_one(cat)
        if hub is None:
            continue
        summaries.append(
            PrecomputedHubSummarySchema(
                id=hub.id,
                topic=hub.topic,
                category=hub.category,
                imageUrl=hub.root.imageUrl,
                summary=(hub.root.summary or "")[:160],
            )
        )
        _append_index(summaries[-1].model_dump())
    return summaries
