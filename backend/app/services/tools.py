"""
Multi-Vector Research Tools for Deep Autonomous Agent Exploration
Implements a retrieval ladder (Tavily -> DuckDuckGo -> Wikipedia) plus
page-content extraction, Wikimedia archives, and OSM geocoding.
Every source URL returned by these tools is real and verifiable.
"""

import asyncio
import html as html_lib
import logging
import os
import re
from urllib.parse import quote

import httpx
from dotenv import load_dotenv

load_dotenv(
    os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), ".env.local"
    )
)
load_dotenv()

from app.schemas.graph import GalleryItemSchema, SourceCitationSchema

logger = logging.getLogger(__name__)

USER_AGENT = "TDILEARNED/2.0 (Today I Learned discovery engine; contact@tdilearned.app)"


# ---------------------------------------------------------------------------
# Retrieval ladder: Tavily -> DuckDuckGo -> Wikipedia
# ---------------------------------------------------------------------------


async def tavily_search(query: str, max_results: int = 5) -> list[SourceCitationSchema] | None:
    """Search via Tavily API. Returns None when no API key is configured."""
    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key:
        return None
    try:
        from tavily import AsyncTavilyClient

        client = AsyncTavilyClient(api_key=api_key)
        resp = await client.search(
            query=query,
            max_results=max_results,
            search_depth="advanced",
            include_answer=False,
            include_raw_content="text",
        )
        sources: list[SourceCitationSchema] = []
        for idx, r in enumerate(resp.get("results", [])):
            url = r.get("url", "")
            title = r.get("title", "") or url
            if not url:
                continue
            sources.append(
                SourceCitationSchema(
                    id=f"tavily-{idx}-{hash(url) % 10**6}",
                    title=title,
                    url=url,
                    snippet=(r.get("content") or "")[:400],
                    publisher=(r.get("domain") or r.get("url") or "Web"),
                    reliabilityScore=0.85,
                )
            )
        return sources
    except Exception as e:
        logger.warning(f"Tavily search error ({e})")
        return None


async def duckduckgo_search(query: str, max_results: int = 5) -> list[SourceCitationSchema] | None:
    """Search via DuckDuckGo. Runs in a thread (SDK is synchronous)."""
    try:
        from ddgs import DDGS

        def _search() -> list[dict]:
            with DDGS() as ddgs:
                return list(ddgs.text(query, max_results=max_results))

        raw_results = await asyncio.to_thread(_search)
        sources: list[SourceCitationSchema] = []
        for idx, r in enumerate(raw_results):
            url = r.get("href", "")
            title = r.get("title", "") or url
            if not url:
                continue
            sources.append(
                SourceCitationSchema(
                    id=f"ddg-{idx}-{hash(url) % 10**6}",
                    title=title,
                    url=url,
                    snippet=(r.get("body") or "")[:400],
                    publisher=(r.get("body") and "Web") or "Web",
                    reliabilityScore=0.75,
                )
            )
        return sources
    except Exception as e:
        logger.warning(f"DuckDuckGo search error ({e})")
        return None


async def wikipedia_search(query: str, max_results: int = 5) -> list[SourceCitationSchema] | None:
    """Search Wikipedia via its public API. Always available (keyless)."""
    try:
        wiki_url = "https://en.wikipedia.org/w/api.php"
        params: dict[str, str | int] = {
            "action": "query",
            "list": "search",
            "srsearch": query,
            "utf8": "1",
            "format": "json",
            "srlimit": max_results,
        }
        headers = {"User-Agent": USER_AGENT}
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.get(wiki_url, params=params, headers=headers)
            if resp.status_code != 200:
                return None
            data = resp.json()
        sources: list[SourceCitationSchema] = []
        for idx, item in enumerate(data.get("query", {}).get("search", [])):
            clean_snippet = item.get("snippet", "")
            clean_snippet = re.sub(r"<[^>]+>", "", clean_snippet)
            clean_snippet = html_lib.unescape(clean_snippet)
            title = item.get("title", "")
            if not title:
                continue
            sources.append(
                SourceCitationSchema(
                    id=f"wiki-{idx}-{item.get('pageid', idx)}",
                    title=f"{title} — Archival Encyclopedia",
                    url=f"https://en.wikipedia.org/wiki/{quote(title.replace(' ', '_'), safe='()')}",
                    snippet=f"{clean_snippet}...",
                    publisher="Wikipedia",
                    reliabilityScore=0.96,
                )
            )
        return sources
    except Exception as e:
        logger.warning(f"Wikipedia search error ({e})")
        return None


async def search_web_ladder(
    query: str,
    max_results: int = 5,
    include_wikipedia: bool = True,
    min_relevance: float = 0.15,
) -> list[SourceCitationSchema]:
    """Run the retrieval ladder and merge results, deduplicating by URL.

    Order of preference: Tavily (needs key) -> DuckDuckGo (keyless) -> Wikipedia.
    Each non-Wikipedia pool is filtered by lexical relevance to the query to keep
    out off-topic noise. Returns a best-effort list of verified sources; never fabricates.
    """
    seen: set[str] = set()
    merged: list[SourceCitationSchema] = []

    def _add(srcs: list[SourceCitationSchema] | None, filter_noise: bool = True) -> None:
        if not srcs:
            return
        if filter_noise:
            srcs = _filter_by_relevance(srcs, query, min_score=min_relevance)
        for s in srcs:
            if s.url in seen:
                continue
            seen.add(s.url)
            merged.append(s)

    # Parallel: Tavily + DuckDuckGo attempt; Wikipedia always as a guaranteed floor.
    ddg_task = duckduckgo_search(query, max_results=max_results)
    wiki_task = wikipedia_search(query, max_results=max_results) if include_wikipedia else None

    _add(await tavily_search(query, max_results=max_results))
    _add(await ddg_task)
    if wiki_task:
        _add(await wiki_task, filter_noise=False)

    # Prefer authoritative sources (Wikipedia/Tavily) over keyless fallbacks.
    merged.sort(key=lambda s: float(s.reliabilityScore or 0.0), reverse=True)
    return merged[: max_results + 3]


# ---------------------------------------------------------------------------
# Page content extraction
# ---------------------------------------------------------------------------

_HTML_TAG_RE = re.compile(r"<[^>]+>")
_SCRIPT_RE = re.compile(r"<(script|style|nav|footer|header)[^>]*>.*?</\1>", re.DOTALL | re.IGNORECASE)

# Tokens that carry no topical signal when matching search results against a query.
_STOPWORDS = {
    "the",
    "a",
    "an",
    "of",
    "to",
    "and",
    "or",
    "in",
    "on",
    "for",
    "with",
    "at",
    "by",
    "from",
    "how",
    "what",
    "why",
    "is",
    "are",
    "was",
    "were",
    "be",
    "do",
    "does",
    "did",
    "vs",
    "versus",
    "it",
    "its",
    "as",
    "this",
    "that",
    "these",
}


def _relevance_score(query: str, title: str, body: str = "") -> float:
    """Cheap lexical relevance: fraction of meaningful query tokens present in result."""
    q_tokens = {t for t in re.findall(r"[a-z0-9]{3,}", query.lower()) if t not in _STOPWORDS}
    if not q_tokens:
        return 0.0
    haystack = (title + " " + body).lower()
    hits = sum(1 for t in q_tokens if t in haystack)
    return hits / len(q_tokens)


def _filter_by_relevance(
    sources: list[SourceCitationSchema],
    query: str,
    min_score: float = 0.15,
) -> list[SourceCitationSchema]:
    """Keep only results that share topical tokens with the query."""
    return [s for s in sources if _relevance_score(query, s.title, s.snippet) >= min_score]


def _strip_html(raw: str, max_chars: int = 4000) -> str:
    """Strip HTML to readable text, removing script/nav boilerplate."""
    cleaned = _SCRIPT_RE.sub(" ", raw)
    cleaned = _HTML_TAG_RE.sub(" ", cleaned)
    cleaned = html_lib.unescape(cleaned)
    lines = [ln.strip() for ln in cleaned.splitlines() if ln.strip()]
    text = " ".join(lines)
    return text[:max_chars]


async def fetch_page_content(url: str | list[str], max_chars: int = 4000) -> str | list[str] | None:
    """Fetch and clean the text content of one URL (or several).

    Returns a cleaned string for a single URL, a list for multiple URLs,
    or None when a single fetch fails.
    """
    if isinstance(url, list):
        results = await asyncio.gather(
            *[fetch_page_content(u, max_chars=max_chars) for u in url],
            return_exceptions=True,
        )
        return [r for r in results if isinstance(r, str)]
    try:
        headers = {
            "User-Agent": USER_AGENT,
            "Accept-Language": "en-US,en;q=0.9",
        }
        async with httpx.AsyncClient(
            timeout=8.0,
            follow_redirects=True,
            headers=headers,
        ) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                return None
            return _strip_html(resp.text, max_chars=max_chars)
    except Exception as e:
        logger.warning(f"Page content fetch error for {url} ({e})")
        return None


# ---------------------------------------------------------------------------
# Media & geography tools
# ---------------------------------------------------------------------------


def proxy_media_url(raw_url: str) -> str:
    """Route an origin media URL through the Cloudflare edge proxy (or Next.js fallback)."""
    cf_base = os.getenv("NEXT_PUBLIC_CF_PROXY_URL", "").rstrip("/")
    if cf_base:
        return f"{cf_base}/media?url={quote(raw_url, safe='')}"
    return f"/api/media?url={quote(raw_url, safe='')}"


async def wikipedia_page_images(query: str, max_images: int = 3) -> list[GalleryItemSchema]:
    """Fetch images actually embedded on the Wikipedia article page for a query.

    Resolves the query to its best-matching article title, then pulls the lead
    image plus page-embedded photographs/illustrations. These are the images
    editors chose for the article, so they are reliably relevant to the topic.
    """
    gallery: list[GalleryItemSchema] = []
    headers = {"User-Agent": USER_AGENT}
    api = "https://en.wikipedia.org/w/api.php"

    try:
        async with httpx.AsyncClient(timeout=8.0, headers=headers) as client:
            # 1) Resolve the query to the best-matching article title.
            search_params: dict[str, str | int] = {
                "action": "query",
                "list": "search",
                "srsearch": query,
                "srlimit": 1,
                "format": "json",
            }
            resp = await client.get(api, params=search_params)
            if resp.status_code != 200:
                return []
            items = resp.json().get("query", {}).get("search", [])
            if not items:
                return []
            title = items[0]["title"]

            # 2) List image file titles embedded in that article.
            img_params: dict[str, str | int] = {
                "action": "query",
                "titles": title,
                "prop": "images",
                "imlimit": max_images * 3,
                "format": "json",
            }
            resp = await client.get(api, params=img_params)
            if resp.status_code != 200:
                return []
            pages = resp.json().get("query", {}).get("pages", {})
            file_titles = []
            for page in pages.values():
                for img in page.get("images", []):
                    name = img.get("title", "")
                    low = name.lower()
                    if any(ext in low for ext in (".jpg", ".jpeg", ".png", ".webp", ".svg", ".tif")):
                        file_titles.append(name)
                    if len(file_titles) >= max_images:
                        break

            if not file_titles:
                return []

            # 3) Resolve those file titles to actual image URLs + metadata.
            info_params: dict[str, str | int] = {
                "action": "query",
                "titles": "|".join(file_titles),
                "prop": "imageinfo",
                "iiprop": "url|extmetadata|size",
                "iiurlwidth": "1280",
                "format": "json",
            }
            resp = await client.get(api, params=info_params)
            if resp.status_code != 200:
                return []
            for page in resp.json().get("query", {}).get("pages", {}).values():
                image_info = page.get("imageinfo", [{}])[0]
                thumb_url = image_info.get("thumburl") or image_info.get("url")
                if not thumb_url:
                    continue
                thumb_url = thumb_url.split("?")[0]
                metadata = image_info.get("extmetadata", {})
                desc = re.sub(r"<[^>]+>", "", metadata.get("ImageDescription", {}).get("value", ""))[:140]
                if not desc:
                    desc = page.get("title", "").replace("File:", "").replace("_", " ").split(".")[0]
                gallery.append(
                    GalleryItemSchema(
                        imageUrl=thumb_url,
                        caption=desc,
                        license=metadata.get("LicenseShortName", {}).get("value", "Public Domain / CC-BY-SA"),
                        originUrl=image_info.get("descriptionurl", thumb_url),
                    )
                )
                if len(gallery) >= max_images:
                    break
    except Exception as e:
        logger.warning(f"Wikipedia page images error for {query!r} ({e})")

    return gallery


async def wikimedia_archive_tool(query: str, max_images: int = 3) -> list[GalleryItemSchema]:
    """Retrieve relevant images for a topic.

    Strategy: first try the images embedded on the topic's Wikipedia article page
    (highest relevance — editors chose them), then top up with a Wikimedia
    Commons file-namespace search so we always return up to max_images.
    """
    gallery = await wikipedia_page_images(query, max_images=max_images)
    if len(gallery) >= max_images:
        return gallery

    gallery.extend(await _commons_search(query, max_images=max_images))
    return gallery


async def _commons_search(query: str, max_images: int = 3) -> list[GalleryItemSchema]:
    """Wikimedia Commons file-namespace search for a query."""
    gallery: list[GalleryItemSchema] = []
    try:
        search_url = "https://commons.wikimedia.org/w/api.php"
        params = {
            "action": "query",
            "generator": "search",
            "gsrsearch": f"{query} filetype:bitmap|drawing",
            "gsrnamespace": "6",
            "gsrlimit": str(max_images + 2),
            "prop": "imageinfo",
            "iiprop": "url|extmetadata|size",
            "iiurlwidth": "1280",
            "format": "json",
        }
        headers = {"User-Agent": USER_AGENT}
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.get(search_url, params=params, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                pages = data.get("query", {}).get("pages", {})
                for page_info in pages.values():
                    image_info = page_info.get("imageinfo", [{}])[0]
                    thumb_url = image_info.get("thumburl") or image_info.get("url")
                    if thumb_url and thumb_url.startswith("http"):
                        thumb_url = thumb_url.split("?")[0]
                        metadata = image_info.get("extmetadata", {})
                        desc = metadata.get("ImageDescription", {}).get("value", "")
                        desc_clean = re.sub(r"<[^>]+>", "", desc)[:140]
                        if not desc_clean:
                            desc_clean = (
                                page_info.get("title", "").replace("File:", "").replace(".jpg", "").replace("_", " ")
                            )

                        license_name = metadata.get("LicenseShortName", {}).get("value", "Public Domain / CC-BY-SA")
                        origin_url = image_info.get("descriptionurl", thumb_url)

                        gallery.append(
                            GalleryItemSchema(
                                imageUrl=thumb_url,
                                caption=desc_clean,
                                license=license_name,
                                originUrl=origin_url,
                            )
                        )
                        if len(gallery) >= max_images:
                            break
    except Exception as e:
        logger.warning(f"Wikimedia archive tool error ({e})")

    return gallery


async def osm_geocoder_tool(location_name: str) -> tuple[float, float, str] | None:
    """Geocode historical or modern geographical place names to precise coordinates."""
    if not location_name or location_name.lower() in ["global observatory", "spacetime", "theoretical"]:
        return None
    try:
        url = "https://nominatim.openstreetmap.org/search"
        params = {
            "q": location_name,
            "format": "json",
            "limit": "1",
            "addressdetails": "1",
        }
        headers = {"User-Agent": USER_AGENT}
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(url, params=params, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                if data and len(data) > 0:
                    item = data[0]
                    lat = float(item.get("lat"))
                    lng = float(item.get("lon"))
                    display = item.get("display_name", location_name).split(",")[0]
                    return lat, lng, display
    except Exception as e:
        logger.warning(f"OSM Geocoder tool error ({e})")
    return None
