"""Map-reduce research graph node tests (LLM + tools mocked)."""

import asyncio

import pytest
from conftest import FakeDispatchLLM, FakeLLM, install_sync_cache

from app.schemas.graph import SourceCitationSchema
from app.services import research_graph
from app.services.research_graph import (
    EventSink,
    LLMChildBranchDefinition,
    LLMDeepDossierOutput,
    LLMResearcherExtraction,
    LLMSeedTreeWithBranches,
    MechanismItem,
    RabbitHoleItem,
    ResearchAngle,
    ResearchFinding,
    ResearchPlan,
    TimelineItem,
    _build_plan_steps,
    _extract_search_keywords,
    _sink,
    aggregator_node,
    build_research_graph,
    fan_out_researchers,
    planner_node,
    reference_extractor_node,
    researcher_node,
    run_research_graph,
    spatial_enricher_node,
    synthesizer_node,
)


@pytest.fixture(autouse=True)
def _cache(monkeypatch):
    return install_sync_cache(monkeypatch, research_graph)


def _config():
    queue: asyncio.Queue = asyncio.Queue()
    sink = EventSink(queue)
    return {"configurable": {"event_sink": sink, "llm_engine": "cerebras"}}, sink, queue


def _drain(queue):
    events = []
    while not queue.empty():
        events.append(queue.get_nowait())
    return events


def _src(url="https://example.com/1", title="Source One"):
    return SourceCitationSchema(id="s1", title=title, url=url, snippet="A fact", publisher="Web")


def _gallery():
    from app.schemas.graph import GalleryItemSchema

    return [GalleryItemSchema(imageUrl="https://img.example/a.jpg", caption="A photo")]


async def _search_sources(*a, **k):
    return [_src()]


async def _search_empty(*a, **k):
    return []


async def _content(*a, **k):
    return "content"


async def _no_content(*a, **k):
    return None


async def _geo(*a, **k):
    return (37.9, 23.7, "Athens")


async def _geo_none(*a, **k):
    return None


async def _gallery_coro(*a, **k):
    return _gallery()


async def _no_gallery(*a, **k):
    return []


def _angle_dict(id="angle-1", question="How did it work?"):
    return {"id": id, "question": question, "rationale": "Because"}


# --------------------------------------------------------------------------- #
# Pure helpers
# --------------------------------------------------------------------------- #


def test_extract_search_keywords_strips_prefixes():
    k = _extract_search_keywords("Antikythera", "What were the precise mechanisms of the Antikythera gears?")
    assert "Antikythera" in k
    assert "what" not in k.lower()


def test_extract_search_keywords_prepends_topic_when_missing():
    k = _extract_search_keywords("Black-Scholes", "Why did the market crash in 1987?")
    assert k.startswith("Black-Scholes")


def test_build_plan_steps_phase_zero():
    steps = _build_plan_steps(0, "Topic")
    assert steps[0].status == "running"
    assert steps[-1].status == "pending"


def test_build_plan_steps_completed_phases():
    steps = _build_plan_steps(5, "Topic", count_findings=3, count_sources=2)
    assert all(s.status == "done" for s in steps)
    assert "3 facts found" in steps[1].title
    assert "2 citations" in steps[2].title


async def test_emit_plan_phase(monkeypatch):
    monkeypatch.setattr(research_graph, "get_llm_with_fallback", lambda *a, **k: FakeLLM())
    _, sink, queue = _config()
    await research_graph._emit_plan_phase(sink, 2, "Topic")
    events = _drain(queue)
    assert events[0]["event"] == "plan"
    assert len(events[0]["data"]["steps"]) == 5


async def test_event_sink_emits():
    _, sink, queue = _config()
    await sink.emit("x", {"a": 1})
    assert _drain(queue) == [{"event": "x", "data": {"a": 1}}]


def test_sink_from_config():
    config, sink, _ = _config()
    assert _sink(config) is sink


# --------------------------------------------------------------------------- #
# planner_node
# --------------------------------------------------------------------------- #


async def test_planner_node_success(monkeypatch):
    plan = ResearchPlan(angles=[ResearchAngle(id="a1", question="Q1?", rationale="R1")])
    monkeypatch.setattr(research_graph, "get_llm_with_fallback", lambda *a, **k: FakeLLM(structured_result=plan))
    config, _, _ = _config()
    state = {"topic": "Antikythera", "category": "History", "context_chain": ["History"]}
    result = await planner_node(state, config)
    assert result["angles"][0]["id"] == "a1"


async def test_planner_node_fallback_angles(monkeypatch):
    monkeypatch.setattr(
        research_graph, "get_llm_with_fallback", lambda *a, **k: FakeLLM(structured_raises=RuntimeError("nope"))
    )
    config, _, _ = _config()
    state = {"topic": "Antikythera", "category": None, "context_chain": []}
    result = await planner_node(state, config)
    assert len(result["angles"]) == 3
    assert result["angles"][0]["question"].startswith("What is the origin story")


async def test_planner_node_no_llm(monkeypatch):
    monkeypatch.setattr(research_graph, "get_llm_with_fallback", lambda *a, **k: None)
    config, _, _ = _config()
    state = {"topic": "X", "category": None, "context_chain": []}
    result = await planner_node(state, config)
    assert len(result["angles"]) == 3


# --------------------------------------------------------------------------- #
# fan_out_researchers
# --------------------------------------------------------------------------- #


def test_fan_out_sends_per_angle():
    sends = fan_out_researchers(
        {"topic": "T", "category": "C", "angles": [_angle_dict("a1"), _angle_dict("a2")]}
    )
    assert len(sends) == 2
    assert all(s.node == "researcher" for s in sends)


# --------------------------------------------------------------------------- #
# researcher_node
# --------------------------------------------------------------------------- #


async def test_researcher_node_extracts_findings(monkeypatch):
    findings = [ResearchFinding(angle_id="x", claim="c", quote="q", source_url="https://e/1", source_title="s")]
    extraction = LLMResearcherExtraction(findings=findings)
    monkeypatch.setattr(research_graph, "get_llm_with_fallback", lambda *a, **k: FakeLLM(structured_result=extraction))
    monkeypatch.setattr(research_graph, "search_web_ladder", _search_sources)
    monkeypatch.setattr(research_graph, "fetch_page_content", _content)

    config, _, _ = _config()
    result = await researcher_node({"topic": "T", "category": "C", "angle": _angle_dict()}, config)
    assert result["findings"][0].angle_id == "angle-1"  # forced to real angle


async def test_researcher_node_snippet_fallback(monkeypatch):
    monkeypatch.setattr(research_graph, "get_llm_with_fallback", lambda *a, **k: FakeLLM(structured_raises=RuntimeError()))
    monkeypatch.setattr(research_graph, "search_web_ladder", _search_sources)
    monkeypatch.setattr(research_graph, "fetch_page_content", _no_content)

    config, _, _ = _config()
    result = await researcher_node({"topic": "T", "category": "C", "angle": _angle_dict()}, config)
    assert len(result["findings"]) >= 1
    assert result["findings"][0].source_url == "https://example.com/1"


async def test_researcher_node_no_sources(monkeypatch):
    monkeypatch.setattr(research_graph, "get_llm_with_fallback", lambda *a, **k: FakeLLM())
    monkeypatch.setattr(research_graph, "search_web_ladder", _search_empty)
    monkeypatch.setattr(research_graph, "fetch_page_content", _no_content)

    config, _, _ = _config()
    result = await researcher_node({"topic": "T", "category": "C", "angle": _angle_dict()}, config)
    assert result["findings"] == []


# --------------------------------------------------------------------------- #
# aggregator_node + reference_extractor_node
# --------------------------------------------------------------------------- #


async def test_aggregator_node_reports_missing_angles():
    config, _, _ = _config()
    state = {"topic": "T", "angles": [_angle_dict("a1"), _angle_dict("a2")], "findings": [], "errors": []}
    result = await aggregator_node(state, config)
    assert result["errors"] == []


async def test_reference_extractor_dedupes_sources():
    config, _, _ = _config()
    findings = [
        ResearchFinding(angle_id="a", claim="c1", quote="q1", source_url="https://e/1", source_title="A"),
        ResearchFinding(angle_id="a", claim="c2", quote="q2", source_url="https://e/1", source_title="A"),
        ResearchFinding(angle_id="a", claim="c3", quote="q3", source_url="", source_title=""),
    ]
    result = await reference_extractor_node({"topic": "T", "findings": findings}, config)
    assert len(result["sources"]) == 1


# --------------------------------------------------------------------------- #
# synthesizer_node
# --------------------------------------------------------------------------- #


def _seed_tree():
    return LLMSeedTreeWithBranches(
        root_dossier=LLMDeepDossierOutput(
            title="Antikythera mechanism",
            tagline="An ancient computer",
            category="History",
            era="c. 200 BCE",
            abstract="Discovered in a shipwreck.",
            coreThesis="The world's first analog computer.",
            timeline=[TimelineItem(date="1901", headline="Found", description="By sponge divers")],
            mechanisms=[MechanismItem(title="Gears", explanation="Bronze gears", bulletPoints=["a"])],
            rabbitHoles=[RabbitHoleItem(title="Hellenistic astronomy", teaser="hook", affinityCategory="History")],
            audioTourScript="Let's explore.",
            wowFact="1,000 years ahead.",
            curiosityScore=9,
            suggested_questions=["How did the gears work?"],
        ),
        children=[
            LLMChildBranchDefinition(
                title="Hellenistic astronomy",
                summary="Study of the heavens",
                category="History",
                era="c. 150 BCE",
                image_search_query="Hellenistic astronomy",
                rabbit_holes=["a"],
                curiosityScore=8,
                curiosityReason="deep link",
            )
        ],
    )


async def test_synthesizer_node_success(monkeypatch):
    monkeypatch.setattr(research_graph, "get_llm_with_fallback", lambda *a, **k: FakeLLM(structured_result=_seed_tree()))
    config, _, _ = _config()
    state = {"topic": "Antikythera", "category": "History", "findings": [], "sources": [], "context_chain": []}
    result = await synthesizer_node(state, config)
    assert result["dossier_data"]["title"] == "Antikythera mechanism"
    assert len(result["children_data"]) == 1


async def test_synthesizer_node_fallback_dossier(monkeypatch):
    monkeypatch.setattr(
        research_graph, "get_llm_with_fallback", lambda *a, **k: FakeLLM(structured_raises=RuntimeError("boom"))
    )
    config, _, _ = _config()
    state = {"topic": "Antikythera", "category": None, "findings": [], "sources": [], "context_chain": []}
    result = await synthesizer_node(state, config)
    assert result["dossier_data"]["title"] == "Antikythera"
    assert result["dossier_data"]["curiosityScore"] == 7


# --------------------------------------------------------------------------- #
# spatial_enricher_node
# --------------------------------------------------------------------------- #


async def test_spatial_enricher_root_and_children(monkeypatch):
    monkeypatch.setattr(research_graph, "osm_geocoder_tool", _geo)
    monkeypatch.setattr(research_graph, "wikimedia_archive_tool", _gallery_coro)
    monkeypatch.setattr(research_graph, "proxy_media_url", lambda url: url)

    config, _, _ = _config()
    state = {
        "topic": "Antikythera",
        "category": "History",
        "parent_id": None,
        "sources": [],
        "findings": [],
        "dossier_data": _seed_tree().root_dossier.model_dump(),
        "children_data": [c.model_dump() for c in _seed_tree().children],
    }
    result = await spatial_enricher_node(state, config)
    assert result["root_node"]["title"] == "Antikythera mechanism"
    assert len(result["child_nodes"]) == 1
    assert result["dossier"]["nodeId"] == result["root_node"]["id"]


async def test_spatial_enricher_no_children_when_parent(monkeypatch):
    monkeypatch.setattr(research_graph, "osm_geocoder_tool", _geo_none)
    monkeypatch.setattr(research_graph, "wikimedia_archive_tool", _no_gallery)
    monkeypatch.setattr(research_graph, "proxy_media_url", lambda url: url)

    config, _, _ = _config()
    state = {
        "topic": "T",
        "category": "C",
        "parent_id": "parent-1",
        "sources": [],
        "findings": [],
        "dossier_data": _seed_tree().root_dossier.model_dump(),
        "children_data": [],
    }
    result = await spatial_enricher_node(state, config)
    assert result["child_nodes"] == []
    assert result["root_node"]["title"] == "Antikythera mechanism"


async def test_spatial_enricher_rabbit_hole_children(monkeypatch):
    monkeypatch.setattr(research_graph, "osm_geocoder_tool", _geo_none)
    monkeypatch.setattr(research_graph, "wikimedia_archive_tool", _no_gallery)
    monkeypatch.setattr(research_graph, "proxy_media_url", lambda url: url)

    config, _, _ = _config()
    state = {
        "topic": "T",
        "category": "C",
        "parent_id": None,
        "sources": [],
        "findings": [],
        "dossier_data": _seed_tree().root_dossier.model_dump(),
        "children_data": [],  # empty → falls back to rabbit holes
    }
    result = await spatial_enricher_node(state, config)
    assert len(result["child_nodes"]) == 1


# --------------------------------------------------------------------------- #
# Graph build + full run
# --------------------------------------------------------------------------- #


def test_build_research_graph():
    graph = build_research_graph()
    assert graph is not None


async def test_run_research_graph_full_flow(monkeypatch):
    from app.schemas.research import ResearchFinding

    dispatch = FakeDispatchLLM(
        {
            ResearchPlan: ResearchPlan(angles=[ResearchAngle(id="a1", question="Q?", rationale="R")]),
            LLMResearcherExtraction: LLMResearcherExtraction(
                findings=[ResearchFinding(angle_id="a1", claim="c", quote="q", source_url="https://e/1", source_title="S")]
            ),
            LLMSeedTreeWithBranches: _seed_tree(),
        }
    )
    monkeypatch.setattr(research_graph, "get_llm_with_fallback", lambda *a, **k: dispatch)

    async def fake_search(q, max_results=5):
        return [_src()]

    async def fake_fetch(url, max_chars=2500):
        return "The content of the page about Antikythera."

    async def fake_geo(name):
        return (37.9, 23.7, "Athens")

    async def fake_wiki(q, max_images=3):
        return _gallery()

    monkeypatch.setattr(research_graph, "search_web_ladder", fake_search)
    monkeypatch.setattr(research_graph, "fetch_page_content", fake_fetch)
    monkeypatch.setattr(research_graph, "osm_geocoder_tool", fake_geo)
    monkeypatch.setattr(research_graph, "wikimedia_archive_tool", fake_wiki)
    monkeypatch.setattr(research_graph, "proxy_media_url", lambda url: url)

    _, sink, queue = _config()
    result = await run_research_graph(topic="Antikythera", category="History", sink=sink, engine="cerebras")
    assert result["root_node"]["title"] == "Antikythera mechanism"
    assert result["child_nodes"]
    events = _drain(queue)
    types = [e["event"] for e in events]
    assert "plan" in types and "dossier" in types and "node_stream" in types
    assert events[-1]["event"] == "done"
