"""
Bulk topic catalog: hundreds of pre-curated topics for instant browsing.

Unlike precomputed hubs (which run the full expensive research graph), the
catalog is a large, cheaply-built pool of real Wikipedia topics — title,
summary, pageviews, category — harvested from the deep category crawls. It lets
the UI show "500+ topics to explore" instantly; clicking one triggers live
research.
"""

import asyncio
import logging
import os
import time
from typing import Any

from app.services.cache import cache_service
from app.services.random_topic import CATEGORY_WIKI_MAP, _catalog_pool

logger = logging.getLogger(__name__)

CATALOG_KEY = "catalog:index"
CATALOG_TTL = 30 * 86400

MIN_CATALOG_SIZE = int(os.getenv("MIN_CATALOG_SIZE", "500"))


def get_catalog() -> list[dict[str, Any]]:
    val = cache_service.get(CATALOG_KEY)
    return val if isinstance(val, list) else []


def _entry(
    item: dict[str, str | int], category: str, precomputed: bool = False
) -> dict[str, Any]:
    return {
        "title": item["title"],
        "summary": str(item.get("summary", ""))[:280],
        "category": category,
        "image_search_query": str(item.get("image_search_query") or item["title"]),
        "pageviews": int(item.get("pageviews") or 0),
        "precomputed": precomputed,
    }


def _merge_hubs(catalog: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Fold deep-researched hubs into the catalog as first-class `precomputed` entries.

    Hub topics are curiosity-hook titles (e.g. "The World's First Analog Computer")
    while crawl entries are real Wikipedia titles (e.g. "Antikythera mechanism"),
    so fuzzy title matching is unreliable. Instead we append each hub as its own
    catalog entry, flagged `precomputed`, so the UI can badge it as instant.
    """
    hubs = cache_service.get("precomputed:index")
    if not isinstance(hubs, list):
        return catalog

    existing = {e.get("title", "").strip().lower() for e in catalog}
    for h in hubs:
        title = (h.get("topic") or "").strip()
        if not title or title.lower() in existing:
            continue
        existing.add(title.lower())
        catalog.append(
            {
                "title": title,
                "summary": (h.get("summary") or "")[:280],
                "category": h.get("category") or "General",
                "image_search_query": title,
                "pageviews": 0,
                "precomputed": True,
            }
        )
    return catalog


async def build_catalog(min_size: int = MIN_CATALOG_SIZE) -> list[dict[str, Any]]:
    """Harvest every category's deep-crawl pool, dedupe, rank by pageviews, persist."""
    started = time.time()
    categories = list(CATEGORY_WIKI_MAP.keys())

    pools = await asyncio.gather(*(_catalog_pool(cat) for cat in categories), return_exceptions=True)

    seen: set[str] = set()
    catalog: list[dict[str, Any]] = []
    for cat, pool in zip(categories, pools):
        if isinstance(pool, BaseException):
            logger.warning(f"[catalog] crawl failed for {cat}: {pool}")
            continue
        for item in pool:
            title = str(item.get("title") or "").strip()
            low = title.lower()
            if not title or low in seen:
                continue
            seen.add(low)
            catalog.append(_entry(item, cat))

    catalog.sort(key=lambda e: int(e.get("pageviews") or 0), reverse=True)
    catalog = _merge_hubs(catalog)
    if len(catalog) < min_size:
        logger.warning(f"[catalog] only {len(catalog)} topics (requested {min_size})")

    cache_service.set(CATALOG_KEY, catalog, ttl_seconds=CATALOG_TTL)
    logger.info(f"[catalog] built {len(catalog)} topics in {time.time() - started:.1f}s")
    return catalog