"""Curiosity-ranked random topic picker.

When a user clicks a hardcoded category root (History, Science, ...), this service
returns a specific, curiosity-worthy topic from that category — like "AI-powered
random Wikipedia". Candidates come live from Wikipedia's category members (sampled
randomly and filtered for quality) plus today's per-domain signal hooks, then the
LLM reranks a small sample and picks the most fascinating one with a one-line reason.

Everything is best-effort: if Wikipedia or the LLM fails, the pick degrades to a
plain random sample from whatever candidates are available.
"""

import logging
import random
import time
import uuid

import httpx
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from app.schemas.graph import NodeSchema, RandomTopicResponse
from app.services.cache import cache_service
from app.services.llm import get_llm

logger = logging.getLogger(__name__)

WIKIPEDIA_UA = "TIL-CuriosityEngine/2.0 (educational project; contact@curiosity.engine)"
MEDIAWIKI_API = "https://en.wikipedia.org/w/api.php"
RANDOM_SUMMARY_URL = "https://en.wikipedia.org/api/rest_v1/page/random/summary"

# Map our landing categories to their Wikipedia category namespace.
CATEGORY_WIKI_MAP = {
    "Science": "Science",
    "History": "History",
    "Mathematics": "Mathematics",
    "Technology": "Technology",
    "Philosophy": "Philosophy",
}

# How many category members to pull, sample, and hand to the LLM.
CATEGORY_MEMBER_LIMIT = 500
CANDIDATE_SAMPLE = 6
LLM_SAMPLE_SIZE = 3

# Signal pool refresh TTL — refetch today's trending/on-this-day hooks at most every 6h.
SIGNAL_POOL_TTL = 6 * 3600

# Skip titles/extracts that are listicles or too short to be interesting.
_MIN_EXTRACT_LEN = 100
_JUNK_MARKERS = ("disambiguation", "index of", "outline of", "timeline of")


class _TopicPick(BaseModel):
    title: str = Field(description="Cleaned, curiosity-hook title under 7 words")
    summary: str = Field(description="One punchy sentence: why this is fascinating, with historical/scientific context")
    reason: str = Field(description="One sentence: why the user should dive into this right now")
    image_search_query: str = Field(description="Wikimedia Commons search key")


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
# Candidate sources (live only — no hard-coded topic lists)
# --------------------------------------------------------------------------- #


async def _category_member_titles(category: str) -> list[str]:
    """Random-ish sample of article titles that are direct members of the category."""
    params: dict[str, str | int] = {
        "action": "query",
        "list": "categorymembers",
        "cmtitle": f"Category:{CATEGORY_WIKI_MAP[category]}",
        "cmnamespace": 0,
        "cmtype": "page",
        "cmlimit": CATEGORY_MEMBER_LIMIT,
        "format": "json",
    }
    async with httpx.AsyncClient(timeout=10.0, headers={"User-Agent": WIKIPEDIA_UA}) as client:
        resp = await client.get(MEDIAWIKI_API, params=params)
        resp.raise_for_status()
        data = resp.json()
        members = data.get("query", {}).get("categorymembers", [])

    filtered = []
    for m in members:
        title = m.get("title", "")
        low = title.lower()
        if ":" in title or low.startswith("list of"):
            continue
        if any(marker in low for marker in _JUNK_MARKERS):
            continue
        if len(title) < 3:
            continue
        filtered.append(title)

    if len(filtered) > 40:
        filtered = random.sample(filtered, 40)
    return filtered


async def _batch_extracts(titles: list[str]) -> list[dict[str, str]]:
    """Fetch short plain-text intros for a batch of titles (one query per 20)."""
    out: list[dict[str, str]] = []
    async with httpx.AsyncClient(timeout=10.0, headers={"User-Agent": WIKIPEDIA_UA}) as client:
        for i in range(0, len(titles), 20):
            batch = titles[i : i + 20]
            params: dict[str, str | int] = {
                "action": "query",
                "titles": "|".join(batch),
                "prop": "extracts",
                "exintro": 1,
                "explaintext": 1,
                "exlimit": "max",
                "format": "json",
            }
            resp = await client.get(MEDIAWIKI_API, params=params)
            resp.raise_for_status()
            pages = resp.json().get("query", {}).get("pages", {})
            for pg in pages.values():
                title = pg.get("title", "")
                extract = (pg.get("extract") or "").strip()
                if title and len(extract) >= _MIN_EXTRACT_LEN:
                    out.append({"title": title, "summary": extract[:280], "image_search_query": title})
    return out


async def _live_wiki_candidates(category: str) -> list[dict[str, str]]:
    """Category-scoped random Wikipedia candidates (best-effort)."""
    try:
        titles = await _category_member_titles(category)
        if not titles:
            return []
        sampled = random.sample(titles, min(CANDIDATE_SAMPLE, len(titles)))
        return await _batch_extracts(sampled)
    except Exception as e:
        logger.warning(f"[random-topic] Wikipedia sampling failed: {e}")
        return []


async def _signal_titles(category: str) -> list[str]:
    """Today's per-domain signal hooks (trending / on-this-day / news), TTL-cached."""
    key = f"signals:pool:{category.lower()}"
    cached = cache_service.get(key)
    if cached and isinstance(cached, dict) and time.time() - cached.get("fetched_at", 0) < SIGNAL_POOL_TTL:
        return cached.get("titles", [])

    try:
        from app.scripts.signal_collector import collect_all_signals

        ctx = await collect_all_signals()
        titles = list(getattr(ctx.per_domain, category, []) or [])
        cache_service.set(key, {"fetched_at": time.time(), "titles": titles}, ttl_seconds=SIGNAL_POOL_TTL)
        return titles
    except Exception as e:
        logger.warning(f"[random-topic] signal refresh failed: {e}")
        return []


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
# LLM rerank
# --------------------------------------------------------------------------- #


async def _llm_pick(category: str, candidates: list[dict[str, str]]) -> _TopicPick | None:
    llm = get_llm("cerebras", temperature=0.4, max_tokens=500)
    if not llm:
        return None
    try:
        structured = llm.with_structured_output(_TopicPick)
        candidate_text = "\n".join(f"{i + 1}. {c['title']} — {c['summary'][:200]}" for i, c in enumerate(candidates))
        user_msg = (
            f"You are an expert at spotting genuinely fascinating, curiosity-worthy topics within '{category}'.\n"
            f"Pick the SINGLE most mind-blowing topic from these candidates:\n{candidate_text}\n"
            "Rules:\n"
            "- Prefer specific events, people, or phenomena over broad subjects\n"
            "- Avoid textbook-style topics; look for surprise, a story, or a counterintuitive twist\n"
            "- title: short curiosity-hook (question or concrete record), under 7 words\n"
            "- summary: one punchy sentence with historical or scientific context\n"
            "- reason: one sentence telling the user why to dive in right now\n"
            "- image_search_query: the best Wikimedia Commons search key"
        )
        result = await structured.ainvoke(
            [  # type: ignore[assignment]
                SystemMessage(content="You pick the most fascinating topic."),
                HumanMessage(content=user_msg),
            ]
        )
        return _TopicPick(**result.model_dump())  # type: ignore[union-attr]
    except Exception as e:
        logger.warning(f"[random-topic] LLM rerank failed ({e}); random fallback")
        return None


def _to_node(topic: dict[str, str], category: str) -> NodeSchema:
    return NodeSchema(
        id=str(uuid.uuid4()),
        title=topic["title"],
        summary=topic["summary"],
        category=category,
        image_search_query=topic["image_search_query"],
        rabbit_holes=[],
        timestamp="Curiosity Pick",
        confidence=0.99,
    )


async def pick_random_topic(category: str) -> RandomTopicResponse:
    """Sample candidates, LLM-rerank, and return the most curiosity-worthy topic."""
    category = _clean_category(category)

    candidates = await _live_wiki_candidates(category)
    known_titles = {c["title"] for c in candidates}
    for signal in await _signal_titles(category):
        if signal and signal not in known_titles:
            candidates.append(
                {"title": signal, "summary": f"A fresh, trending topic: {signal}.", "image_search_query": signal}
            )
            known_titles.add(signal)

    if not candidates:
        candidates = await _fallback_any_page()

    if not candidates:
        return RandomTopicResponse(
            node=NodeSchema(
                id=str(uuid.uuid4()),
                title="Serendipity",
                summary="A random curiosity pick — the source APIs were unreachable, but exploration continues.",
                category=category,
                image_search_query="curiosity",
                rabbit_holes=[],
            ),
            reason="Sometimes you just click and see what happens.",
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
                image_search_query=pick.image_search_query or sample[0]["image_search_query"],
                rabbit_holes=[],
                timestamp="Curiosity Pick",
                confidence=0.99,
            ),
            reason=pick.reason,
            category=category,
        )

    chosen = random.choice(sample)
    return RandomTopicResponse(
        node=_to_node(chosen, category),
        reason=f"Random pick from {category} — guaranteed to lead somewhere surprising.",
        category=category,
    )
