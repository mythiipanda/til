"""
Signal Collector — Lightweight Real-World Context Layer
Fetches current signals from free sources (Google News, Wikipedia Trending,
Wikipedia On This Day, Reddit, Hacker News) and:
  1. Classifies signals into the 5 top-level domains for L1→L2 spice.
  2. Extracts "fresh curiosity seeds" — diverse, fascinating fresh topics
     used as additional top-level (L1) roots in the generated tree.
All other tree expansion is curiosity-score driven (evergreen knowledge).
"""

import asyncio
import json
import logging
import os
import sys
from datetime import UTC, datetime, timedelta

import httpx

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
PROJECT_ROOT = os.path.abspath(os.path.join(BACKEND_DIR, ".."))
sys.path.insert(0, BACKEND_DIR)

from dotenv import load_dotenv

load_dotenv(os.path.join(PROJECT_ROOT, ".env.local"))
load_dotenv(os.path.join(PROJECT_ROOT, ".env"))

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from app.services.llm import get_llm

logger = logging.getLogger(__name__)

# --------------------------------------------------------------------------- #
# LLM setup (reuses same keys as main generator)
# --------------------------------------------------------------------------- #
_cerebras_llm = get_llm(engine="cerebras", temperature=0.3, max_tokens=600)
_mistral_llm = get_llm(engine="mistral", temperature=0.3, max_tokens=600)

TOP_DOMAINS = ["Science", "History", "Mathematics", "Technology", "Philosophy"]

REDDIT_SUBS = ["todayilearned", "AskHistorians", "explainlikeimfive", "interestingasfuck"]

# --------------------------------------------------------------------------- #
# Pydantic schemas
# --------------------------------------------------------------------------- #


class DomainSignalMap(BaseModel):
    """One real-world hook per domain, used to spice L1→L2 expansion."""

    Science: list[str] = Field(default_factory=list)
    History: list[str] = Field(default_factory=list)
    Mathematics: list[str] = Field(default_factory=list)
    Technology: list[str] = Field(default_factory=list)
    Philosophy: list[str] = Field(default_factory=list)


class FreshSeedTopic(BaseModel):
    title: str = Field(description="Curiosity-hook title ideally under 6 words; question-hook or concrete-record style")
    summary: str = Field(description="1 plain-English sentence explaining why it is fascinating and current")


class FreshSeedPool(BaseModel):
    seeds: list[FreshSeedTopic] = Field(description="Exactly 6 diverse fresh curiosity seed topics")


class SignalContext(BaseModel):
    per_domain: DomainSignalMap
    raw_signals: list[str]
    sources_used: list[str]
    fresh_seeds: list[FreshSeedTopic] = Field(default_factory=list)
    fetched_at: str


# --------------------------------------------------------------------------- #
# Source 1: Google News RSS  (free, anonymous)
# --------------------------------------------------------------------------- #


async def _fetch_google_news(client: httpx.AsyncClient) -> list[str]:
    """Pulls top headlines from Google News RSS. No key needed."""
    try:
        import feedparser

        resp = await client.get(
            "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en",
            timeout=8.0,
        )
        feed = feedparser.parse(resp.text)
        titles = [e.title for e in feed.entries[:15] if hasattr(e, "title")]
        logger.info(f"[signal] Google News: {len(titles)} headlines")
        return titles
    except Exception as e:
        logger.warning(f"[signal] Google News failed: {e}")
        return []


# --------------------------------------------------------------------------- #
# Source 2: Wikipedia Top Viewed Pages  (Wikimedia Analytics API, free)
# --------------------------------------------------------------------------- #


async def _fetch_wikipedia_trending(client: httpx.AsyncClient) -> list[str]:
    """Top ~15 most-viewed Wikipedia articles, walking back days until data exists."""
    try:
        for days_back in range(1, 8):
            day = datetime.now(UTC) - timedelta(days=days_back)
            day_str = day.strftime("%Y/%m/%d")
            resp = await client.get(
                f"https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/{day_str}",
                headers={"User-Agent": "TDILEARNED/2.0 (Today I Learned discovery engine; contact@tdilearned.app)"},
                timeout=8.0,
            )
            if resp.status_code != 200:
                continue
            data = resp.json()
            items = (data or {}).get("items") or []
            if not items:
                continue
            articles = items[0].get("articles", [])[:20]
            # Filter meta/utility pages
            skip = {"Main_Page", "Special:Search", "Wikipedia:Featured_articles"}
            titles = [
                a.get("article", "").replace("_", " ")
                for a in articles
                if a.get("article") not in skip
                and not a.get("article", "").startswith(("Special:", "Wikipedia:", "Portal:"))
            ][:15]
            logger.info(f"[signal] Wikipedia trending ({day_str}): {len(titles)} articles")
            return titles
        logger.warning("[signal] Wikipedia trending: no pageview data in the last 7 days")
        return []
    except Exception as e:
        logger.warning(f"[signal] Wikipedia trending failed: {e}")
        return []


# --------------------------------------------------------------------------- #
# Source 3: Wikipedia On This Day  (free REST API)
# --------------------------------------------------------------------------- #


async def _fetch_on_this_day(client: httpx.AsyncClient) -> list[str]:
    """Historical events that happened on today's date — timeless hooks."""
    try:
        now = datetime.now(UTC)
        resp = await client.get(
            f"https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/{now.month:02d}/{now.day:02d}",
            headers={"User-Agent": "TDILEARNED/2.0 (Today I Learned discovery engine; contact@tdilearned.app)"},
            timeout=8.0,
        )
        events = resp.json().get("events", [])
        texts = [e.get("text", "")[:120] for e in events[:8] if e.get("text")]
        logger.info(f"[signal] On This Day: {len(texts)} events")
        return texts
    except Exception as e:
        logger.warning(f"[signal] On This Day failed: {e}")
        return []


# --------------------------------------------------------------------------- #
# Source 4: Reddit (free JSON API, no key)
# --------------------------------------------------------------------------- #


async def _fetch_reddit(client: httpx.AsyncClient, subreddit: str) -> list[str]:
    """Top posts from a curiosity-friendly subreddit via its public RSS feed."""
    try:
        import feedparser

        url = f"https://www.reddit.com/r/{subreddit}/top/.rss?limit=10"
        resp = await client.get(
            url,
            headers={"User-Agent": "TDILEARNED/2.0 (Today I Learned discovery engine; contact@tdilearned.app)"},
            timeout=8.0,
        )
        if resp.status_code == 429:
            await asyncio.sleep(2.0)
            resp = await client.get(
                f"https://www.reddit.com/r/{subreddit}/hot/.rss?limit=10",
                headers={"User-Agent": "TDILEARNED/2.0 (Today I Learned discovery engine; contact@tdilearned.app)"},
                timeout=8.0,
            )
        feed = feedparser.parse(resp.text)
        titles = []
        for entry in feed.entries[:10]:
            title = getattr(entry, "title", "")
            if not title:
                continue
            # Reddit prefixes that spoil the hook
            cleaned = title.strip()
            for prefix in ("TIL that ", "TIL ", "ELI5: ", "TIL - "):
                if cleaned.lower().startswith(prefix.lower()):
                    cleaned = cleaned[len(prefix) :].strip()
                    cleaned = cleaned[:1].upper() + cleaned[1:] if cleaned else cleaned
                    break
            titles.append(cleaned[:140])
        logger.info(f"[signal] Reddit r/{subreddit}: {len(titles)} titles")
        return titles
    except Exception as e:
        logger.warning(f"[signal] Reddit r/{subreddit} failed: {e}")
        return []


async def _fetch_reddit_all(client: httpx.AsyncClient) -> list[str]:
    """Sequential Reddit fetches with pacing to dodge datacenter rate limits."""
    all_titles: list[str] = []
    for i, sub in enumerate(REDDIT_SUBS):
        titles = await _fetch_reddit(client, sub)
        all_titles.extend(titles)
        if i < len(REDDIT_SUBS) - 1:
            await asyncio.sleep(1.5)
    return all_titles


# --------------------------------------------------------------------------- #
# Source 5: Hacker News (free Firebase API, no key)
# --------------------------------------------------------------------------- #


async def _fetch_hacker_news(client: httpx.AsyncClient) -> list[str]:
    """Top ~10 Hacker News stories with their titles."""
    try:
        resp = await client.get(
            "https://hacker-news.firebaseio.com/v0/topstories.json",
            timeout=8.0,
        )
        ids = resp.json()[:12]
        titles = []
        for item_id in ids:
            try:
                item = await client.get(
                    f"https://hacker-news.firebaseio.com/v0/item/{item_id}.json",
                    timeout=8.0,
                )
                data = item.json()
                title = (data or {}).get("title", "")
                if title:
                    titles.append(title[:140])
            except Exception as e:
                logger.warning(f"[signal] HN item {item_id} failed: {e}")
        logger.info(f"[signal] Hacker News: {len(titles)} stories")
        return titles
    except Exception as e:
        logger.warning(f"[signal] Hacker News failed: {e}")
        return []


# --------------------------------------------------------------------------- #
# LLM Classifier: bucket signals into the 5 domains
# --------------------------------------------------------------------------- #


async def _classify_signals(raw_signals: list[str]) -> DomainSignalMap:
    """
    Single LLM call to route each signal into one of the 5 domains.
    Returns up to 3 signals per domain as potential L2 inspiration hooks.
    """
    if not raw_signals:
        return DomainSignalMap()

    signal_list = "\n".join(f"- {s}" for s in raw_signals[:30])
    sys_msg = (
        "You are a knowledge domain classifier. For each signal below, assign it to exactly "
        "one of: Science, History, Mathematics, Technology, Philosophy. "
        "Return a JSON object with keys matching the 5 domains and values as lists of "
        "the signal texts that belong there. Only include signals with a clear domain fit. "
        "Keep up to 3 per domain. Return valid JSON only."
    )
    user_msg = f"Classify these signals:\n{signal_list}"

    for llm in [_cerebras_llm, _mistral_llm]:
        if llm is None:
            continue
        try:
            resp = await llm.ainvoke(
                [
                    SystemMessage(content=sys_msg),
                    HumanMessage(content=user_msg),
                ]
            )
            # Parse the raw JSON response
            text = resp.content.strip()  # type: ignore[union-attr]
            # Strip markdown code fences if present
            if text.startswith("```"):
                text = text.split("```")[1]
                text = text.removeprefix("json")
            data = json.loads(text.strip())
            return DomainSignalMap(**{k: v for k, v in data.items() if k in TOP_DOMAINS})
        except Exception as e:
            logger.warning(f"[signal] classifier error: {e}")
            continue

    return DomainSignalMap()


# --------------------------------------------------------------------------- #
# LLM Fresh-Seed Extraction: pick diverse fascinating current topics as roots
# --------------------------------------------------------------------------- #


async def _extract_fresh_seeds(raw_signals: list[str]) -> list[FreshSeedTopic]:
    """
    One structured LLM call that curates 6 diverse, genuinely fascinating fresh
    topics from today's signals to serve as top-level roots of the tree.
    """
    if not raw_signals:
        return []

    signal_list = "\n".join(f"- {s}" for s in raw_signals[:40])
    sys_msg = (
        "You are a world-class curiosity editor for a discovery engine. "
        "From the real-world signals below, curate EXACTLY 6 diverse topics that a "
        "curious person would find fascinating RIGHT NOW. Rules:\n"
        "- Prefer topics with surprise, counterintuitive twists, specific named things, "
        "or unresolved mysteries. Avoid generic news recaps and corporate/political stories.\n"
        "- Titles must be curiosity hooks, ideally under 6 words, e.g. 'Why Bees Can Count', "
        "'The Deep-Sea Fish With See-Through Head', 'Ancient Roman Concrete Self-Heals'.\n"
        "- Spread the 6 seeds across different domains (science, history, tech, math, philosophy) "
        "if the signals allow.\n"
        "- Summaries: one plain-English sentence explaining why it is fascinating."
    )
    user_msg = f"Signals:\n{signal_list}"

    for llm in [_cerebras_llm, _mistral_llm]:
        if llm is None:
            continue
        try:
            structured = llm.with_structured_output(FreshSeedPool)
            res: FreshSeedPool = await structured.ainvoke(
                [  # type: ignore[assignment]
                    SystemMessage(content=sys_msg),
                    HumanMessage(content=user_msg),
                ]
            )
            logger.info(f"[signal] Fresh seeds curated: {len(res.seeds)}")
            return res.seeds[:6]
        except Exception as e:
            logger.warning(f"[signal] fresh-seed extraction error: {e}")
            continue

    return []


# --------------------------------------------------------------------------- #
# Main entry point
# --------------------------------------------------------------------------- #


async def collect_all_signals() -> SignalContext:
    """
    Fetches signals from all 3 sources concurrently, deduplicates,
    and classifies into the 5 knowledge domains.
    Takes ~3-8 seconds total.
    """
    print("[signal] Collecting real-world signals...", flush=True)

    async with httpx.AsyncClient() as client:
        results = await asyncio.gather(
            _fetch_google_news(client),
            _fetch_wikipedia_trending(client),
            _fetch_on_this_day(client),
            _fetch_hacker_news(client),
            _fetch_reddit_all(client),
            return_exceptions=True,
        )

    sources_used = []
    raw_signals: list[str] = []

    source_names = [
        "google_news",
        "wikipedia_trending",
        "on_this_day",
        "hacker_news",
        "reddit",
    ]
    for name, result in zip(source_names, results):
        if isinstance(result, Exception):
            logger.warning(f"[signal] {name} raised: {result}")
        elif result:
            raw_signals.extend(result)  # type: ignore[arg-type]
            sources_used.append(name)

    # Deduplicate
    seen = set()
    unique_signals = []
    for s in raw_signals:
        key = s.lower()[:60]
        if key not in seen:
            seen.add(key)
            unique_signals.append(s)

    print(f"[signal] {len(unique_signals)} unique signals from {sources_used}", flush=True)

    # Classify into domains
    domain_map = await _classify_signals(unique_signals)

    # Curate fresh curiosity seeds to use as additional L1 roots
    fresh_seeds = await _extract_fresh_seeds(unique_signals)

    ctx = SignalContext(
        per_domain=domain_map,
        raw_signals=unique_signals,
        sources_used=sources_used,
        fresh_seeds=fresh_seeds,
        fetched_at=datetime.now(UTC).isoformat(),
    )

    # Pretty print domain summary
    for domain in TOP_DOMAINS:
        hooks = getattr(ctx.per_domain, domain, [])
        if hooks:
            print(f"[signal]   {domain}: {len(hooks)} hook(s)", flush=True)
    if ctx.fresh_seeds:
        print(f"[signal]   Fresh curiosity seeds: {len(ctx.fresh_seeds)}", flush=True)

    return ctx


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    ctx = asyncio.run(collect_all_signals())
    print("\n=== Signal Context ===")
    for domain in TOP_DOMAINS:
        hooks = getattr(ctx.per_domain, domain, [])
        if hooks:
            print(f"\n{domain}:")
            for h in hooks:
                print(f"  • {h[:100]}")
    if ctx.fresh_seeds:
        print("\nFresh Curiosity Seeds:")
        for s in ctx.fresh_seeds:
            print(f"  • {s.title} — {s.summary[:100]}")
