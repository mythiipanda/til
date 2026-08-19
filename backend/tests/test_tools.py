"""Retrieval ladder / page extraction / media tools tests (mocked HTTP)."""

import pytest
from conftest import FakeResponse, install_sync_cache, patch_shared_client

from app.schemas.graph import SourceCitationSchema
from app.services import tools
from app.services.tools import (
    _filter_by_relevance,
    _relevance_score,
    _strip_html,
    duckduckgo_search,
    fetch_page_content,
    osm_geocoder_tool,
    proxy_media_url,
    search_web_ladder,
    wikimedia_archive_tool,
    wikipedia_page_images,
    wikipedia_search,
)


@pytest.fixture(autouse=True)
def _cache(monkeypatch):
    return install_sync_cache(monkeypatch, tools)


def _src(url, title, snippet="snippet", publisher="Web", reliability=0.92):
    return SourceCitationSchema(
        id=f"id-{url}", title=title, url=url, snippet=snippet, publisher=publisher, reliabilityScore=reliability
    )


# --------------------------------------------------------------------------- #
# Pure helpers
# --------------------------------------------------------------------------- #


def test_relevance_score_stopwords_only():
    assert _relevance_score("the and or", "Whatever Title") == 0.0


def test_relevance_score_matches_tokens():
    assert _relevance_score("antikythera mechanism", "Antikythera mechanism gears") > 0.0


def test_filter_by_relevance():
    srcs = [_src("https://a", "Antikythera mechanism found"), _src("https://b", "Unrelated painting")]
    kept = _filter_by_relevance(srcs, "antikythera mechanism", min_score=0.5)
    assert len(kept) == 1
    assert kept[0].url == "https://a"


def test_strip_html_removes_scripts():
    raw = "<html><script>var x=1;</script><p>Hello <b>world</b> &amp; friends</p><footer>bye</footer></html>"
    text = _strip_html(raw, max_chars=200)
    assert "var x" not in text
    assert "Hello" in text and "world" in text and "&" in text and "friends" in text
    assert "bye" not in text


def test_strip_html_truncates():
    text = _strip_html("<p>" + "word " * 1000 + "</p>", max_chars=100)
    assert len(text) <= 100


# --------------------------------------------------------------------------- #
# HTTP-backed tools
# --------------------------------------------------------------------------- #


async def test_duckduckgo_search_formats_results(monkeypatch):
    async def fake_to_thread(fn, *args, **kwargs):
        return [{"href": "https://ddg.example/1", "title": "Antikythera mechanism", "body": "ancient computer"}]

    monkeypatch.setattr("asyncio.to_thread", fake_to_thread)
    result = await duckduckgo_search("anything")
    assert result and result[0].url == "https://ddg.example/1"
    assert result[0].reliabilityScore == 0.75


async def test_duckduckgo_search_error(monkeypatch):
    async def fake_to_thread(fn, *args, **kwargs):
        raise RuntimeError("ddgs broken")

    monkeypatch.setattr("asyncio.to_thread", fake_to_thread)
    assert await duckduckgo_search("anything") is None


async def test_wikipedia_search_success(monkeypatch):
    def handler(url, params, json=None):
        assert "en.wikipedia.org" in url
        return FakeResponse(
            200,
            {
                "query": {
                    "search": [
                        {"pageid": 1, "title": "Antikythera mechanism", "snippet": "<b>ancient</b> computer"}
                    ]
                }
            },
        )

    patch_shared_client(monkeypatch, tools, handler)
    srcs = await wikipedia_search("antikythera")
    assert srcs and srcs[0].title.startswith("Antikythera mechanism")
    assert "ancient computer" in srcs[0].snippet
    assert "Antikythera_mechanism" in srcs[0].url


async def test_wikipedia_search_http_error(monkeypatch):
    patch_shared_client(monkeypatch, tools, lambda *a, **k: FakeResponse(500))
    assert await wikipedia_search("x") is None


async def test_wikipedia_search_exception(monkeypatch):
    def boom(url, params, json=None):
        raise RuntimeError("down")

    patch_shared_client(monkeypatch, tools, boom)
    assert await wikipedia_search("x") is None


async def test_search_web_ladder_merges_and_dedupes(monkeypatch):
    async def fake_ddg(q, max_results=5):
        return [_src("https://ddg.example/1", "Antikythera device gears", "antikythera")]

    async def fake_wiki(q, max_results=5):
        return [
            _src(
                "https://en.wikipedia.org/wiki/Antikythera_mechanism",
                "Antikythera mechanism — Archival Encyclopedia",
                "antikythera",
                publisher="Wikipedia",
                reliability=0.96,
            ),
            _src("https://ddg.example/1", "Antikythera device gears", "antikythera"),  # dup URL
        ]

    monkeypatch.setattr(tools, "duckduckgo_search", fake_ddg)
    monkeypatch.setattr(tools, "wikipedia_search", fake_wiki)

    res = await search_web_ladder("antikythera mechanism")
    urls = [s.url for s in res]
    assert len(urls) == 2
    assert urls[0] == "https://en.wikipedia.org/wiki/Antikythera_mechanism"  # reliability sorted first


async def test_search_web_ladder_returns_cache(monkeypatch):
    cache = install_sync_cache(monkeypatch, tools)
    cached = [_src("https://cached.example", "Cached result", "snippet").model_dump()]
    cache.set("tool:search:antikythera:5:True", cached)
    res = await search_web_ladder("Antikythera")
    assert len(res) == 1
    assert res[0].url == "https://cached.example"


async def test_fetch_page_content_single(monkeypatch):
    patch_shared_client(monkeypatch, tools, lambda *a, **k: FakeResponse(200, text="<p>hello <b>world</b></p>"))
    result = await fetch_page_content("https://x")
    assert "hello" in result and "world" in result


async def test_fetch_page_content_non_200(monkeypatch):
    patch_shared_client(monkeypatch, tools, lambda *a, **k: FakeResponse(404))
    assert await fetch_page_content("https://x") is None


async def test_fetch_page_content_exception(monkeypatch):
    def boom(url, params, json=None):
        raise RuntimeError("down")

    patch_shared_client(monkeypatch, tools, boom)
    assert await fetch_page_content("https://x") is None


async def test_fetch_page_content_multiple_urls(monkeypatch):
    def handler(url, params, json=None):
        if "good" in url:
            return FakeResponse(200, text="<p>good content</p>")
        return FakeResponse(404)

    patch_shared_client(monkeypatch, tools, handler)
    result = await fetch_page_content(["https://good", "https://bad"])
    assert result == ["good content"]


def test_proxy_media_url_uses_cf(monkeypatch):
    monkeypatch.setenv("NEXT_PUBLIC_CF_PROXY_URL", "https://proxy.example")
    url = proxy_media_url("https://upload.wikimedia.org/x.jpg")
    assert url.startswith("https://proxy.example/media?url=")


def test_proxy_media_url_falls_back_to_nextjs(monkeypatch):
    monkeypatch.delenv("NEXT_PUBLIC_CF_PROXY_URL", raising=False)
    url = proxy_media_url("https://upload.wikimedia.org/x.jpg")
    assert url.startswith("/api/media?url=")


async def test_wikipedia_page_images_full_flow(monkeypatch):
    def handler(url, params, json=None):
        # 1) search resolves title
        if params and params.get("list") == "search":
            return FakeResponse(200, {"query": {"search": [{"title": "Antikythera mechanism"}]}})
        # 2) images list
        if params and params.get("prop") == "images":
            return FakeResponse(
                200,
                {"query": {"pages": {"1": {"images": [{"title": "File:Antikythera_front.jpg"}, {"title": "File:doc.pdf"}]}}}},
            )
        # 3) imageinfo
        if params and params.get("prop") == "imageinfo":
            return FakeResponse(
                200,
                {
                    "query": {
                        "pages": {
                            "1": {
                                "imageinfo": [
                                    {
                                        "thumburl": "https://upload.wikimedia.org/x?width=1280",
                                        "url": "https://upload.wikimedia.org/x",
                                        "descriptionurl": "https://commons/desc",
                                        "extmetadata": {"LicenseShortName": {"value": "CC-BY-SA"}},
                                    }
                                ]
                            }
                        }
                    }
                },
            )
        return FakeResponse(404)

    patch_shared_client(monkeypatch, tools, handler)
    gallery = await wikipedia_page_images("antikythera", max_images=1)
    assert len(gallery) == 1
    assert gallery[0].imageUrl == "https://upload.wikimedia.org/x"
    assert gallery[0].license == "CC-BY-SA"


async def test_wikipedia_page_images_no_results(monkeypatch):
    def handler(url, params, json=None):
        return FakeResponse(200, {"query": {"search": []}})

    patch_shared_client(monkeypatch, tools, handler)
    assert await wikipedia_page_images("nothing") == []


async def test_wikipedia_page_images_error(monkeypatch):
    def boom(url, params, json=None):
        raise RuntimeError("down")

    patch_shared_client(monkeypatch, tools, boom)
    assert await wikipedia_page_images("x") == []


async def test_wikimedia_archive_tool_tops_up_from_commons(monkeypatch):
    from app.schemas.graph import GalleryItemSchema

    async def fake_wpi(q, max_images=3):
        return []

    async def fake_commons(q, max_images=3):
        return [GalleryItemSchema(imageUrl="https://commons.example/a.jpg", caption="A photo", license="CC")]

    monkeypatch.setattr(tools, "wikipedia_page_images", fake_wpi)
    monkeypatch.setattr(tools, "_commons_search", fake_commons)
    gallery = await wikimedia_archive_tool("antikythera", max_images=3)
    assert len(gallery) == 1
    assert gallery[0].imageUrl == "https://commons.example/a.jpg"


async def test_commons_search_skips_non_http(monkeypatch):
    def handler(url, params, json=None):
        return FakeResponse(
            200,
            {
                "query": {
                    "pages": {
                        "1": {"imageinfo": [{"thumburl": "ftp://nope.example/a.jpg", "url": "https://x"}]},
                        "2": {"imageinfo": [{"thumburl": "https://ok.example/b.jpg"}]},
                    }
                }
            },
        )

    patch_shared_client(monkeypatch, tools, handler)
    from app.services.tools import _commons_search

    gallery = await _commons_search("antikythera", max_images=3)
    assert len(gallery) == 1
    assert gallery[0].imageUrl == "https://ok.example/b.jpg"


async def test_osm_geocoder_tool_rejects_abstract_names():
    assert await osm_geocoder_tool("") is None
    assert await osm_geocoder_tool("Global Observatory") is None
    assert await osm_geocoder_tool("Spacetime") is None


async def test_osm_geocoder_tool_success(monkeypatch):
    def handler(url, params, json=None):
        return FakeResponse(200, [{"lat": "37.9838", "lon": "23.7275", "display_name": "Athens, Greece, EU"}])

    patch_shared_client(monkeypatch, tools, handler)
    result = await osm_geocoder_tool("Athens")
    assert result == (37.9838, 23.7275, "Athens")


async def test_osm_geocoder_tool_returns_cached(monkeypatch):
    cache = install_sync_cache(monkeypatch, tools)
    cache.set("tool:osm:athens", [1.0, 2.0, "Athens"])
    result = await osm_geocoder_tool("Athens")
    assert result == (1.0, 2.0, "Athens")


async def test_osm_geocoder_tool_exception(monkeypatch):
    def boom(url, params, json=None):
        raise RuntimeError("down")

    patch_shared_client(monkeypatch, tools, boom)
    assert await osm_geocoder_tool("Athens") is None


async def test_shared_client_reuse_and_close(monkeypatch):
    from app.services.tools import aclose_shared_client, get_shared_client

    a = await get_shared_client()
    b = await get_shared_client()
    assert a is b
    await aclose_shared_client()
    c = await get_shared_client()
    assert c is not a