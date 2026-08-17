"""Curiosity-ranked random topic picker.

When a user clicks a category root (History, Science, Culture, ...), this service
returns a specific, curiosity-worthy topic from that category — "AI-powered random
Wikipedia". Candidate topics come from three live tiers:

  1. Deep Wikipedia crawl — walks 3 levels of subcategories to collect real
     articles (not umbrella/meta pages), filtered and ranked by recent pageviews.
  2. LLM seed-query resolution — an LLM proposes curiosity directions for the
     category; each is resolved through Wikipedia search to a REAL article.
  3. Live signals — today's trending / news / on-this-day / reddit / HN hooks.

The merged pool is cached per category, sampled, and finally reranked by the LLM,
which picks the single most mind-blowing topic with a one-line reason.

Every candidate must resolve to a real, researchable article — the LLM directs
*where to look*, reality decides *the topic*. Everything is best-effort: on any
failure it degrades to a plain random pick from whatever is available.
"""

import asyncio
import logging
import random
import time
import uuid

import httpx
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from app.schemas.graph import NodeSchema, RandomTopicResponse
from app.services.cache import cache_service
from app.services.llm import get_llm_with_fallback

logger = logging.getLogger(__name__)

WIKIPEDIA_UA = "TDILEARNED/2.0 (Today I Learned discovery engine; contact@tdilearned.app)"
MEDIAWIKI_API = "https://en.wikipedia.org/w/api.php"
RANDOM_SUMMARY_URL = "https://en.wikipedia.org/api/rest_v1/page/random/summary"

# Map our landing categories to Wikipedia's Main topic classifications.
CATEGORY_WIKI_MAP = {
    "Science": "Science",
    "History": "History",
    "Mathematics": "Mathematics",
    "Technology": "Technology",
    "Philosophy": "Philosophy",
    "Culture": "Culture",
    "Geography": "Geography",
    "Health": "Health",
    "Nature": "Nature",
    "People": "People",
    "Religion": "Religion",
    "Society": "Society",
    "Language": "Language",
    "Law": "Law",
    "Politics": "Politics",
    "Education": "Education",
    "Engineering": "Engineering",
    "Energy": "Energy",
    "Food and drink": "Food and drink",
    "Economy": "Economy",
    "Time": "Time",
}

# Deep-crawl tuning: how many subcategory levels to walk, page cap, and how many
# pageview-top candidates to keep in each category's cached pool.
CRAWL_MAX_DEPTH = 3
CRAWL_MAX_PAGES = 800
CRAWL_MAX_SUBCATS_PER_LEVEL = 24
CRAWL_CONCURRENCY = 3  # parallel category fetches (keep under Wikimedia's rate limit)
POOL_PAGEVIEWS_KEEP = 60
POOL_TTL = 6 * 3600  # refetch the category pool at most every 6h

CANDIDATE_SAMPLE = 6
LLM_SAMPLE_SIZE = 8

# Catalog harvest: keep many more pageview-notable candidates per category than
# the live pick pool (60). 21 categories x this = thousands of deduped topics.
CATALOG_POOL_KEEP = 200
CATALOG_POOL_TTL = 7 * 86400  # refetch the bulk catalog at most weekly

# Signal pool refresh TTL — refetch today's trending/on-this-day hooks at most every 6h.
SIGNAL_POOL_TTL = 6 * 3600
# Cap how long we wait for live signals on each pick; the crawl + seed pools are
# the primary quality drivers, so fresh hooks are merged only if they arrive fast.
SIGNAL_FETCH_TIMEOUT = 4.0

# Skip titles/extracts that are listicles or too short to be interesting.
_MIN_EXTRACT_LEN = 100
_META_PREFIXES = (
    "list of",
    "index of",
    "outline of",
    "glossary of",
    "timeline of",
    "bibliography of",
    "chronology of",
    "overview of",
)
_META_SUFFIXES = (
    "disambiguation",
    "in popular culture",
    "in fiction",
    "statistics",
    "studies",
    "category",
)
_NAMESPACE_PREFIXES = ("Wikipedia:", "Portal:", "Category:", "Template:", "Help:", "Talk:", "File:")


class _TopicPick(BaseModel):
    title: str = Field(
        description="The real, accurate subject or article title (e.g. 'Fast Fourier Transform', 'Black-Scholes Model', 'The Library of Alexandria'). Do NOT invent metaphorical nicknames."
    )
    summary: str = Field(description="One punchy sentence: why this is fascinating, with historical/scientific context")
    reason: str = Field(description="One sentence: why the user should dive into this right now")
    image_search_query: str = Field(description="Wikimedia Commons search key")
    curiosity_score: int = Field(default=8, description="Honest 1-10 rating of how mind-blowing this topic is")
    wow_fact: str | None = Field(default=None, description="One surprising, mind-blowing sentence about this topic")


class _SeedQueries(BaseModel):
    queries: list[str] = Field(description="Exactly 6 curiosity-directed search queries")


def _clean_category(category: str) -> str:
    """Normalize a user-supplied category to one of our landing categories."""
    cleaned = category.strip().title()
    if cleaned in CATEGORY_WIKI_MAP:
        return cleaned
    for key in CATEGORY_WIKI_MAP:
        if key.lower() in cleaned.lower() or cleaned.lower() in key.lower():
            return key
    return "History"


# --------------------------------------------------------------------------- #
# Deep Wikipedia category crawl (tier 1)
# --------------------------------------------------------------------------- #


def _is_interesting_title(title: str, category: str) -> bool:
    """Reject umbrella/meta/list pages; keep concrete story-worthy articles."""
    low = title.strip().lower()
    if len(title) < 3:
        return False
    if any(low.startswith(p.lower()) for p in _NAMESPACE_PREFIXES):
        return False
    if low.startswith(_META_PREFIXES) or low.endswith(_META_SUFFIXES):
        return False
    # Single-word titles are usually the category umbrella itself ("History",
    # "Biography", "Physics") — not curiosity picks.
    if len(title.split()) < 2:
        return False
    if low == category.lower():
        return False
    return "disambiguation" not in low


async def _rate_limited_get(
    client: httpx.AsyncClient,
    url: str,
    params: dict[str, str | int],
    retries: int = 4,
) -> httpx.Response:
    """GET with a global concurrency cap and 429/5xx retry-with-backoff.

    Wikipedia's MediaWiki API throttles bursty bots (429); this paces parallel
    category traversal below the limit and retries politely on rate limits.
    """
    for attempt in range(retries):
        try:
            resp = await client.get(url, params=params)
            if resp.status_code == 429 or resp.status_code >= 500:
                backoff = 0.5 * (2**attempt)
                logger.warning(f"[random-topic] HTTP {resp.status_code}, retrying in {backoff:.1f}s")
                await asyncio.sleep(backoff)
                continue
            resp.raise_for_status()
            return resp
        except httpx.HTTPStatusError:
            raise
        except httpx.TransportError as e:
            logger.warning(f"[random-topic] transport error ({e}), retrying in 0.5s")
            await asyncio.sleep(0.5)
    raise httpx.HTTPStatusError(
        "Exhausted retries", request=client.build_request("GET", url, params=params), response=httpx.Response(429)
    )


async def _fetch_category_members(client: httpx.AsyncClient, cat_title: str) -> tuple[list[str], list[str]]:
    """Return (subcategory titles, article titles) directly in a category, paginated."""
    subcats: list[str] = []
    pages: list[str] = []
    params: dict[str, str | int] = {
        "action": "query",
        "list": "categorymembers",
        "cmtitle": cat_title,
        "cmtype": "page|subcat",
        "cmlimit": "max",
        "format": "json",
    }
    while True:
        resp = await _rate_limited_get(client, MEDIAWIKI_API, params)
        data = resp.json()
        for m in data.get("query", {}).get("categorymembers", []):
            if m.get("ns") == 14:  # Category namespace
                subcats.append(m["title"])
            elif m.get("ns") == 0:  # Article namespace
                pages.append(m["title"])
        cont = data.get("continue")
        if not cont:
            break
        params["cmcontinue"] = cont["cmcontinue"]
    return subcats, pages


async def _collect_category_tree(category: str) -> list[str]:
    """BFS over the category subtree up to CRAWL_MAX_DEPTH, returning real article titles."""
    async with httpx.AsyncClient(timeout=20.0, headers={"User-Agent": WIKIPEDIA_UA}) as client:
        root = f"Category:{category}"
        visited_cats: set[str] = {root}
        titles: set[str] = set()
        frontier: list[tuple[str, int]] = [(root, 0)]
        semaphore = asyncio.Semaphore(CRAWL_CONCURRENCY)

        async def _bounded_fetch(cat: str) -> tuple[list[str], list[str]]:
            async with semaphore:
                return await _fetch_category_members(client, cat)

        while frontier and len(titles) < CRAWL_MAX_PAGES:
            results = await asyncio.gather(
                *(_bounded_fetch(cat) for cat, _ in frontier),
                return_exceptions=True,
            )
            next_frontier: list[tuple[str, int]] = []
            for (cat, depth), result in zip(frontier, results):
                if isinstance(result, BaseException):
                    logger.warning(f"[random-topic] category fetch failed for {cat}: {result}")
                    continue
                subcats, pages = result
                for page in pages:
                    if len(titles) >= CRAWL_MAX_PAGES:
                        break
                    if _is_interesting_title(page, category):
                        titles.add(page)
                if depth + 1 <= CRAWL_MAX_DEPTH:
                    for subcat in subcats:
                        if subcat not in visited_cats and len(next_frontier) < CRAWL_MAX_SUBCATS_PER_LEVEL:
                            visited_cats.add(subcat)
                            next_frontier.append((subcat, depth + 1))
            frontier = next_frontier

        return list(titles)


async def _batch_extracts(titles: list[str], category: str) -> list[dict[str, str | int]]:
    """Fetch plain-text intros + recent pageviews for a batch of titles (20 per query)."""
    out: list[dict[str, str | int]] = []
    async with httpx.AsyncClient(timeout=15.0, headers={"User-Agent": WIKIPEDIA_UA}) as client:
        for i in range(0, len(titles), 20):
            batch = titles[i : i + 20]
            params: dict[str, str | int] = {
                "action": "query",
                "titles": "|".join(batch),
                "prop": "extracts|pageviews",
                "exintro": 1,
                "explaintext": 1,
                "exlimit": "max",
                "format": "json",
            }
            try:
                resp = await _rate_limited_get(client, MEDIAWIKI_API, params)
                pages = resp.json().get("query", {}).get("pages", {})
            except Exception as e:
                logger.warning(f"[random-topic] extract batch failed: {e}")
                continue
            for pg in pages.values():
                title = pg.get("title", "")
                extract = (pg.get("extract") or "").strip()
                pv = pg.get("pageviews") or {}
                views = sum(v for v in pv.values() if isinstance(v, int))
                if title and len(extract) >= _MIN_EXTRACT_LEN and _is_interesting_title(title, category):
                    out.append(
                        {"title": title, "summary": extract[:280], "image_search_query": title, "pageviews": views}
                    )
    return out


async def _deep_crawl_pool(category: str) -> list[dict[str, str | int]]:
    """Deep-crawled candidates for a category, ranked by recent pageviews, cached."""
    key = f"topics:crawl:{category.lower()}"
    cached = cache_service.get(key)
    if cached and isinstance(cached, list) and cached:
        return cached  # type: ignore[return-value]

    try:
        titles = await _collect_category_tree(category)
        if not titles:
            return []
        # Rank by pageviews, keep the notable top slice as the pool.
        enriched = await _batch_extracts(titles, category)
        enriched.sort(key=lambda c: int(c["pageviews"]), reverse=True)
        pool = enriched[:POOL_PAGEVIEWS_KEEP]
        if pool:
            cache_service.set(key, pool, ttl_seconds=POOL_TTL)
            logger.info(f"[random-topic] crawl pool for {category}: {len(pool)} candidates (from {len(titles)} titles)")
        return pool
    except Exception as e:
        logger.warning(f"[random-topic] deep crawl failed for {category}: {e}")
        return []


async def _catalog_pool(category: str) -> list[dict[str, str | int]]:
    """Bulk harvest for a category: deep-crawl + batch-extract up to CATALOG_POOL_KEEP candidates.

    The live pick pool truncates to POOL_PAGEVIEWS_KEEP (60) for freshness; the
    catalog keeps a much larger slice (200) so we can preload hundreds of topics
    without re-crawling per request. Cached weekly.
    """
    key = f"topics:catalog:{category.lower()}"
    cached = cache_service.get(key)
    if cached and isinstance(cached, list) and cached:
        return cached  # type: ignore[return-value]

    try:
        titles = await _collect_category_tree(category)
        if not titles:
            return []
        enriched = await _batch_extracts(titles, category)
        enriched.sort(key=lambda c: int(c["pageviews"]), reverse=True)
        pool = enriched[:CATALOG_POOL_KEEP]
        if pool:
            cache_service.set(key, pool, ttl_seconds=CATALOG_POOL_TTL)
            logger.info(
                f"[random-topic] catalog pool for {category}: {len(pool)} candidates (from {len(titles)} titles)"
            )
        return pool
    except Exception as e:
        logger.warning(f"[random-topic] catalog crawl failed for {category}: {e}")
        return []


# --------------------------------------------------------------------------- #
# LLM seed-query resolution (tier 2)
# --------------------------------------------------------------------------- #


async def _llm_seed_queries(category: str) -> list[str]:
    """LLM proposes curiosity-directed search queries for a category."""
    llm = get_llm_with_fallback(engine="cerebras", fallback_engine="mistral", temperature=0.9, max_tokens=300)
    if not llm or not llm.is_available:
        return []
    try:
        structured = llm.with_structured_output(_SeedQueries)
        result = await structured.ainvoke(
            [
                SystemMessage(
                    content=(
                        "You are a curiosity editor. Given a knowledge domain, write exactly 6 "
                        "search queries that would surface the most fascinating, surprising, "
                        "story-worthy topics in that domain. Prefer specific events, people, "
                        "phenomena, and counterintuitive twists over broad subjects."
                    )
                ),
                HumanMessage(content=f"Domain: {category}. Return exactly 6 queries."),
            ]
        )  # type: ignore[assignment]
        queries = result.queries if isinstance(result, _SeedQueries) else _SeedQueries(**result).queries  # type: ignore[arg-type]
        return queries[:6]
    except Exception as e:
        logger.warning(f"[random-topic] seed-query generation failed: {e}")
        return []


async def _resolve_seed_query(client: httpx.AsyncClient, query: str) -> list[str]:
    """Resolve a seed query to real Wikipedia article titles via search."""
    try:
        params: dict[str, str | int] = {
            "action": "query",
            "list": "search",
            "srsearch": query,
            "srlimit": 3,
            "srnamespace": 0,
            "format": "json",
        }
        resp = await client.get(MEDIAWIKI_API, params=params)
        resp.raise_for_status()
        hits = resp.json().get("query", {}).get("search", [])
        return [h.get("title", "") for h in hits if h.get("title")]
    except Exception as e:
        logger.warning(f"[random-topic] seed query resolve failed ({query[:40]}): {e}")
        return []


async def _seed_query_pool(category: str) -> list[dict[str, str | int]]:
    """LLM-directed candidates resolved to REAL articles, cached."""
    key = f"topics:seed:{category.lower()}"
    cached = cache_service.get(key)
    if cached and isinstance(cached, list) and cached:
        return cached  # type: ignore[return-value]

    queries = await _llm_seed_queries(category)
    if not queries:
        return []

    async with httpx.AsyncClient(timeout=15.0, headers={"User-Agent": WIKIPEDIA_UA}) as client:
        resolved_sets = await asyncio.gather(*(_resolve_seed_query(client, q) for q in queries))
    titles: list[str] = []
    seen: set[str] = set()
    for resolved in resolved_sets:
        for t in resolved:
            if t not in seen and _is_interesting_title(t, category):
                seen.add(t)
                titles.append(t)

    pool = await _batch_extracts(titles, category)
    if pool:
        cache_service.set(key, pool, ttl_seconds=POOL_TTL)
        logger.info(f"[random-topic] seed pool for {category}: {len(pool)} candidates")
    return pool


# --------------------------------------------------------------------------- #
# Live signal hooks (tier 3)
# --------------------------------------------------------------------------- #


async def _signal_titles(category: str) -> list[str]:
    """Today's per-domain signal hooks (trending / on-this-day / news), TTL-cached.

    Refreshes are expensive (~15-25s of paced upstream fetches), so they run in
    the background and are only waited on for a short budget. If the refresh is
    still in flight, we return whatever was cached before — the crawl + seed
    candidate pools carry the quality while signals stay a best-effort spice.
    """
    key = f"signals:pool:{category.lower()}"
    cached = cache_service.get(key)
    if cached and isinstance(cached, dict) and time.time() - cached.get("fetched_at", 0) < SIGNAL_POOL_TTL:
        return cached.get("titles", [])

    async def _refresh() -> list[str]:
        try:
            from app.scripts.signal_collector import collect_all_signals

            ctx = await collect_all_signals()
            titles = list(getattr(ctx.per_domain, category, []) or [])
            cache_service.set(key, {"fetched_at": time.time(), "titles": titles}, ttl_seconds=SIGNAL_POOL_TTL)
            return titles
        except Exception as e:
            logger.warning(f"[random-topic] signal refresh failed: {e}")
            return []

    task = asyncio.create_task(_refresh())
    deadline = time.monotonic() + SIGNAL_FETCH_TIMEOUT
    while not task.done():
        if time.monotonic() >= deadline:
            logger.info("[random-topic] signal refresh exceeded budget; continuing without fresh hooks")
            return (cached or {}).get("titles", []) if isinstance(cached, dict) else []
        await asyncio.sleep(0.1)
    return (
        task.result()
        if not task.cancelled()
        else ((cached or {}).get("titles", []) if isinstance(cached, dict) else [])
    )


async def _fallback_any_page() -> list[dict[str, str]]:
    """Last resort: any random Wikipedia page regardless of category."""
    try:
        async with httpx.AsyncClient(timeout=10.0, headers={"User-Agent": WIKIPEDIA_UA}) as client:
            resp = await client.get(RANDOM_SUMMARY_URL)
            resp.raise_for_status()
            data = resp.json()
            title = data.get("title", "")
            extract = (data.get("extract") or "").strip()
            if title:
                return [{"title": title, "summary": extract[:280] or title, "image_search_query": title}]
    except Exception as e:
        logger.warning(f"[random-topic] fallback random page failed: {e}")
    return []


# --------------------------------------------------------------------------- #
# LLM rerank + final pick
# --------------------------------------------------------------------------- #


async def _llm_pick(category: str, candidates: list[dict[str, str | int]]) -> _TopicPick | None:
    llm = get_llm_with_fallback(engine="cerebras", fallback_engine="mistral", temperature=0.4, max_tokens=500)
    if not llm or not llm.is_available:
        return None
    try:
        structured = llm.with_structured_output(_TopicPick)
        candidate_text = "\n".join(
            f"{i + 1}. {c['title']} — {str(c['summary'])[:200]}" for i, c in enumerate(candidates)
        )
        user_msg = (
            f"You are an expert at spotting genuinely fascinating, curiosity-worthy topics within '{category}'.\n"
            f"Pick the SINGLE most mind-blowing topic from these candidates:\n{candidate_text}\n"
            "Rules:\n"
            "- Prefer specific events, people, or phenomena over broad subjects\n"
            "- Avoid textbook-style topics; look for surprise, a story, or a counterintuitive twist\n"
            "- title: short curiosity-hook (question or concrete record), under 7 words\n"
            "- summary: one punchy sentence with historical or scientific context\n"
            "- reason: one sentence telling the user why to dive in right now\n"
            "- image_search_query: the best Wikimedia Commons search key\n"
            "- curiosity_score: integer between 8 and 10\n"
            "- wow_fact: one surprising, mind-blowing sentence about this topic"
        )
        result = await structured.ainvoke(
            [  # type: ignore[assignment]
                SystemMessage(content="You pick the most fascinating topic for curious readers."),
                HumanMessage(content=user_msg),
            ]
        )
        return result if isinstance(result, _TopicPick) else _TopicPick(**result.model_dump())
    except Exception as e:
        logger.warning(f"[random-topic] LLM rerank failed ({e}); random fallback")
        return None


def _to_node(topic: dict[str, str], category: str) -> NodeSchema:
    return NodeSchema(
        id=str(uuid.uuid4()),
        title=topic["title"],
        summary=topic["summary"],
        category=category,
        image_search_query=topic.get("image_search_query") or topic["title"],
        rabbit_holes=[],
        timestamp="Curiosity Pick",
        confidence=0.99,
        curiosity_score=8,
        wow_fact=topic.get("wow_fact") or f"A remarkable turning point in {category} history.",
    )


async def pick_random_topic(category: str) -> RandomTopicResponse:
    """Merge all candidate tiers, LLM-rerank, and return the most curiosity-worthy topic."""
    category = _clean_category(category)

    # Check cached crawl + seed pools
    key_crawl = f"topics:crawl:{category.lower()}"
    key_seed = f"topics:seed:{category.lower()}"
    cached_crawl = cache_service.get(key_crawl) or []
    cached_seed = cache_service.get(key_seed) or []

    candidates: list[dict[str, str | int]] = list(cached_crawl) + list(cached_seed)  # type: ignore[arg-type]

    # If cache is not ready, quickly pull candidates from the catalog / precomputed hubs
    if not candidates:
        try:
            from app.services.catalog import get_catalog

            cat_topics = [t for t in get_catalog() if t.get("category", "").lower() == category.lower()]
            if cat_topics:
                candidates.extend(cat_topics[:20])
        except Exception:
            pass

    # If still empty, run fast seed query pool
    if not candidates:
        seed_pool = await _seed_query_pool(category)
        candidates.extend(seed_pool)

    # If still empty, fallback
    if not candidates:
        candidates = [dict(c) for c in await _fallback_any_page()]  # type: ignore[misc]

    if not candidates:
        return RandomTopicResponse(
            node=NodeSchema(
                id=str(uuid.uuid4()),
                title="The Antikythera Mechanism",
                summary="A 2,000-year-old astronomical clockwork computer discovered in a Greek shipwreck, baffling modern engineers.",
                category=category,
                image_search_query="Antikythera mechanism",
                rabbit_holes=[],
                curiosity_score=10,
                wow_fact="Its 37 meshing gears were over 1,000 years ahead of anything else built in human history.",
            ),
            reason="Explore the world's first analog computer.",
            category=category,
        )

    sample = random.sample(candidates, min(LLM_SAMPLE_SIZE, len(candidates)))
    pick = await _llm_pick(category, sample)
    if pick:
        return RandomTopicResponse(
            node=NodeSchema(
                id=str(uuid.uuid4()),
                title=pick.title,
                summary=pick.summary,
                category=category,
                image_search_query=pick.image_search_query or str(sample[0]["image_search_query"]),
                rabbit_holes=[],
                timestamp="Curiosity Pick",
                confidence=0.99,
                curiosity_score=pick.curiosity_score,
                wow_fact=pick.wow_fact,
            ),
            reason=pick.reason,
            category=category,
        )

    chosen = random.choice(sample)
    return RandomTopicResponse(
        node=_to_node({k: str(v) for k, v in chosen.items()}, category),
        reason=f"Random pick from {category} — guaranteed to lead somewhere surprising.",
        category=category,
    )
