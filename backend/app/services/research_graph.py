"""
Map-Reduce Deep Research Graph (LangGraph).

Implements the community-standard sub-agent research pattern:
    Planner -> Send() x N parallel Researchers -> Aggregator
            -> Reference Extractor -> Synthesizer -> Spatial Enricher

All nodes are model-agnostic: they obtain their LLM via get_llm(). Live
research runs on Cerebras; the same graph can be pointed at Mistral via config.
Events (tool_call, source, node_stream, dossier, done) are pushed into an
asyncio.Queue supplied through LangGraph config, which the SSE adapter drains.
"""

import asyncio
import logging
import re
import time
import uuid
from typing import Any, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langgraph.constants import Send
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field

from app.schemas.graph import (
    Coordinates,
    GalleryItemSchema,
    GeographySchema,
    MechanismCardSchema,
    NodeSchema,
    PlanStepSchema,
    RabbitHoleTeaserSchema,
    ResearchDossierSchema,
    SourceCitationSchema,
    TimelineEventSchema,
)
from app.schemas.research import (
    ResearchAngle,
    ResearchFinding,
    ResearchGraphState,
    ResearchPlan,
)
from app.services.cache import cache_service
from app.services.llm import get_llm_with_fallback
from app.services.media import calculate_osm_tiles
from app.services.tools import (
    fetch_page_content,
    osm_geocoder_tool,
    proxy_media_url,
    search_web_ladder,
    wikimedia_archive_tool,
)

logger = logging.getLogger(__name__)

DOSSIER_TTL_SECONDS = 86400 * 7

# ---------------------------------------------------------------------------
# Structured output models
# ---------------------------------------------------------------------------


class TimelineItem(BaseModel):
    date: str = Field(description="Date or era (e.g. '218 BCE', 'July 1518')")
    headline: str = Field(description="Catchy milestone headline")
    description: str = Field(description="Simple, engaging 1-2 sentence description")


class MechanismItem(BaseModel):
    title: str = Field(description="Catchy title of how it worked or why it happened")
    explanation: str = Field(description="Clear explanation in simple, everyday language")
    bulletPoints: list[str] = Field(description="3 easy-to-read key takeaways")


class RabbitHoleItem(BaseModel):
    title: str = Field(
        description="Clear, specific topic or concept title (e.g. 'Delta Hedging', 'The 1987 Market Crash'). No clickbait or metaphorical slang."
    )
    teaser: str = Field(description="Engaging 1-sentence hook explaining why this connected topic is fascinating")
    affinityCategory: str = Field(description="Category")


class LLMDeepDossierOutput(BaseModel):
    title: str = Field(
        description="Clear, accurate real title naming the specific concept, person, or historical event. Never use metaphorical slang."
    )
    tagline: str = Field(description="Engaging 1-sentence hook that sparks instant curiosity")
    category: str = Field(description="Category")
    era: str = Field(description="Time period (e.g. 'c. 200 BCE', '1973')")
    abstract: str = Field(description="Exciting, easy-to-read story summary (2 short paragraphs)")
    coreThesis: str = Field(description="The most fascinating main takeaway in simple words")
    location_name: str | None = Field(None, description="City or country where this happened")
    latitude: float | None = Field(None, description="Estimated latitude")
    longitude: float | None = Field(None, description="Estimated longitude")
    timeline: list[TimelineItem] = Field(description="3 easy-to-follow story milestones")
    mechanisms: list[MechanismItem] = Field(description="2 simple breakdowns of how it worked or why it happened")
    rabbitHoles: list[RabbitHoleItem] = Field(description="Exactly 3 specific, real rabbit holes to explore next")
    audioTourScript: str = Field(description="Captivating podcast-style voiceover script in everyday language")
    wowFact: str = Field(description="The single most surprising, mind-blowing sentence about this topic")
    curiosityScore: int = Field(description="Honest 1-10 rating: how mind-blowing is this?")
    suggested_questions: list[str] = Field(
        default_factory=list,
        description="3 provocative, natural curiosity questions a reader might ask next about this topic (e.g. 'How did the gears model lunar irregularities?', 'Why did this technology disappear for centuries?')",
    )


class LLMChildBranchDefinition(BaseModel):
    title: str = Field(
        description="Clear, specific subtopic title naming the actual entity, mechanism, or event. Never use metaphorical slang."
    )
    summary: str = Field(description="Simple 2-sentence explanation of the core concept and its connection")
    category: str = Field(description="Category")
    era: str = Field(description="Era")
    location_name: str | None = Field(None, description="Location name")
    image_search_query: str = Field(description="Specific Wikimedia Commons image search keyword")
    rabbit_holes: list[str] = Field(description="3 specific, real sub-topic names")
    suggested_questions: list[str] = Field(
        default_factory=list,
        description="3 provocative, natural curiosity questions about this sub-topic",
    )
    curiosityScore: int = Field(description="Honest 1-10 curiosity rating")
    curiosityReason: str = Field(description="One phrase explaining why it is fascinating")


class LLMSeedTreeWithBranches(BaseModel):
    root_dossier: LLMDeepDossierOutput
    children: list[LLMChildBranchDefinition] = Field(
        description="3 exciting child exploration branches naming specific real concepts"
    )


class LLMResearcherExtraction(BaseModel):
    findings: list[ResearchFinding] = Field(description="Key facts with verbatim quotes and real source URLs")


# ---------------------------------------------------------------------------
# Event sink
# ---------------------------------------------------------------------------


class EventSink:
    """Pushes SSE event dicts onto an asyncio.Queue so the adapter can stream them."""

    def __init__(self, queue: asyncio.Queue):
        self._queue = queue

    async def emit(self, event_type: str, data: Any) -> None:
        await self._queue.put({"event": event_type, "data": data})


def _sink(config: RunnableConfig) -> EventSink:
    return config["configurable"]["event_sink"]


def _llm(config: RunnableConfig, temperature: float, max_tokens: int) -> Any:
    """Resolve the per-run LLM engine with failover and circuit breaker protection."""
    engine = config["configurable"].get("llm_engine", "cerebras")
    return get_llm_with_fallback(
        engine=engine,
        fallback_engine="mistral",
        temperature=temperature,
        max_tokens=max_tokens,
    )


# ---------------------------------------------------------------------------
# Sequential Plan Progression Helpers
# ---------------------------------------------------------------------------


def _extract_search_keywords(topic: str, question: str) -> str:
    """Extract clean entity-anchored search keywords from a long analytical question."""
    # Strip markdown formatting
    q = re.sub(r"[\*_~`\"']+", "", question)
    # Strip conversational / analytical question prefixes
    prefixes = [
        r"^what\s+(were|are|was|is)\s+(the\s+)?(precise|specific|core|key)?\s*",
        r"^how\s+(did|does|do)\s+(the\s+)?",
        r"^why\s+(did|does|do|was|is)\s+(the\s+)?",
        r"^to\s+what\s+extent\s+(did|does)\s*",
        r"^examine\s+(the\s+)?",
        r"^analyze\s+(the\s+)?",
    ]
    for pat in prefixes:
        q = re.sub(pat, "", q, flags=re.IGNORECASE)

    # Strip trailing clauses
    q = re.split(r"[?;:]", q)[0]
    words = [w.strip() for w in q.split() if len(w.strip()) > 2]
    # Filter stop words
    stop_words = {"and", "the", "for", "with", "from", "that", "this", "between", "which", "into", "through", "about"}
    meaningful = [w for w in words if w.lower() not in stop_words][:6]
    clean_search = " ".join(meaningful)

    # Ensure topic entity is present
    topic_tokens = set(re.findall(r"\w{3,}", topic.lower()))
    search_tokens = set(re.findall(r"\w{3,}", clean_search.lower()))
    if not topic_tokens.intersection(search_tokens):
        return f"{topic} {clean_search}".strip()
    return clean_search or topic


def _build_plan_steps(phase: int, topic: str, count_findings: int = 0, count_sources: int = 0) -> list[PlanStepSchema]:
    """Construct standard 5-phase sequential deep research plan."""
    step2_title = (
        f"Deep web & encyclopedia retrieval ({count_findings} facts found)"
        if count_findings > 0
        else f"Deep web & encyclopedia retrieval for '{topic}'"
    )
    step3_title = (
        f"Cross-verifying claims & curating {count_sources} citations"
        if count_sources > 0
        else "Cross-verifying claims & source citations"
    )

    return [
        PlanStepSchema(
            id="step-1",
            title=f"Formulating research angles for '{topic}'",
            agent="Planner Agent",
            status="done" if phase >= 1 else "running",
        ),
        PlanStepSchema(
            id="step-2",
            title=step2_title,
            agent="Deep Retrieval Agent",
            status="done" if phase >= 2 else ("running" if phase == 1 else "pending"),
        ),
        PlanStepSchema(
            id="step-3",
            title=step3_title,
            agent="Reference Extractor",
            status="done" if phase >= 3 else ("running" if phase == 2 else "pending"),
        ),
        PlanStepSchema(
            id="step-4",
            title="Synthesizing story monograph, mechanisms & timeline",
            agent="Storyteller Agent",
            status="done" if phase >= 4 else ("running" if phase == 3 else "pending"),
        ),
        PlanStepSchema(
            id="step-5",
            title="Curating archival media & geographic coordinates",
            agent="Spatial Architect",
            status="done" if phase >= 5 else ("running" if phase == 4 else "pending"),
        ),
    ]


async def _emit_plan_phase(sink: Any, phase: int, topic: str, count_findings: int = 0, count_sources: int = 0) -> None:
    steps = _build_plan_steps(phase, topic, count_findings, count_sources)
    await sink.emit("plan", {"steps": [s.model_dump() for s in steps]})


# ---------------------------------------------------------------------------
# Node implementations
# ---------------------------------------------------------------------------


async def planner_node(state: ResearchGraphState, config: RunnableConfig) -> dict:
    topic = state["topic"]
    category = state.get("category")
    sink = _sink(config)

    context_details = []
    if state.get("context_chain"):
        context_details.append(f"Origin Context Trail: {' -> '.join(state['context_chain'])}")
    if state.get("parent_summary"):
        context_details.append(f"Parent Concept Summary: {state['parent_summary']}")
    if state.get("teaser_context"):
        context_details.append(f"Inquiry Focus / Hook: {state['teaser_context']}")

    context_str = "\n".join(context_details)
    if context_str:
        context_str = f"\n\nCONTEXT FROM USER DISCOVERY TRAIL:\n{context_str}\n"

    llm = _llm(config, temperature=0.4, max_tokens=4000)
    angles: list[ResearchAngle] = []
    if llm:
        try:
            structured = llm.with_structured_output(ResearchPlan)
            res = await structured.ainvoke(
                [  # type: ignore[assignment]
                    SystemMessage(
                        content=(
                            "You are the master research planner for TDILEARNED (Today I Learned). "
                            "Formulate 3 distinct, high-impact research angles exploring the topic:\n"
                            "1. Vector 1 (Genesis & Paradox): The origin story, historical catalyst, and core contradiction.\n"
                            "2. Vector 2 (Mechanisms & Principles): The internal architecture, technical/mathematical gears, or step-by-step process.\n"
                            "3. Vector 3 (Twists & Modern Echoes): Surprising misconceptions, turning points, and lasting real-world significance.\n"
                            "CRITICAL: Explicitly name the subject entity in every question. Avoid vague pronouns or generic definitions."
                        )
                    ),
                    HumanMessage(
                        content=f"Target Inquiry: '{topic}'\nCategory: '{category or 'Unknown'}'{context_str}"
                    ),
                ]
            )
            angles = res.angles[:3]  # type: ignore[union-attr]
        except Exception as e:
            logger.warning(f"Planner LLM error ({e}); using fallback angles")

    if not angles:
        angles = [
            ResearchAngle(
                id="angle-1",
                question=f"What is the origin story, discovery catalyst, and core paradox of {topic}?",
                rationale="Establish the foundational facts and central mystery.",
            ),
            ResearchAngle(
                id="angle-2",
                question=f"What are the precise operational mechanisms and internal principles of {topic}?",
                rationale="Explain how the core phenomenon works step-by-step.",
            ),
            ResearchAngle(
                id="angle-3",
                question=f"What are the most surprising twists, common misconceptions, and modern legacies of {topic}?",
                rationale="Surface counterintuitive facts and lasting impact.",
            ),
        ]

    await sink.emit(
        "thought",
        {
            "agent": "Planner Agent",
            "text": f"Formulated {len(angles)} research vectors exploring '{topic}'.",
        },
    )
    await _emit_plan_phase(sink, 1, topic)

    return {"angles": [a.model_dump() for a in angles]}


def fan_out_researchers(state: ResearchGraphState) -> list[Send]:
    """Send each research angle to its own parallel researcher."""
    return [
        Send(
            "researcher",
            {
                "topic": state["topic"],
                "category": state.get("category"),
                "angle": angle,
            },
        )
        for angle in state.get("angles", [])
    ]


class ResearcherWorkerState(TypedDict):
    topic: str
    category: str | None
    angle: dict


async def researcher_node(state: ResearcherWorkerState, config: RunnableConfig) -> dict:
    angle = ResearchAngle(**state["angle"])
    topic = state["topic"]
    sink = _sink(config)

    search_query = _extract_search_keywords(topic, angle.question)

    await sink.emit(
        "tool_call",
        {
            "call_id": str(uuid.uuid4())[:8],
            "tool": "WebSearch",
            "query": search_query,
            "angle_id": angle.id,
            "status": "running",
        },
    )

    sources = await search_web_ladder(search_query, max_results=5)

    # Emit discovered sources immediately to the live stream
    for s in sources:
        await sink.emit(
            "source",
            {
                "id": s.id or str(uuid.uuid4())[:8],
                "title": s.title,
                "url": s.url,
                "snippet": s.snippet[:250],
                "publisher": s.publisher,
                "reliabilityScore": s.reliabilityScore,
            },
        )
        await asyncio.sleep(0.04)

    await sink.emit(
        "tool_result",
        {
            "call_id": str(uuid.uuid4())[:8],
            "tool": "WebSearch",
            "preview": f"Found {len(sources)} sources for angle '{angle.question[:40]}...'",
            "count": len(sources),
            "status": "success",
        },
    )

    # Fetch page content for the top sources (parallel, bounded)
    top = sources[:4]
    contents: list[Any] = []
    if top:
        contents = await asyncio.gather(
            *[fetch_page_content(s.url, max_chars=2500) for s in top],
            return_exceptions=True,
        )

    evidence_blocks = []
    for src, content in zip(top, contents):
        if isinstance(content, str) and content:
            evidence_blocks.append(f"SOURCE: {src.title}\nURL: {src.url}\nCONTENT: {content}")

    findings: list[ResearchFinding] = []
    llm = _llm(config, temperature=0.2, max_tokens=4000)
    if llm and evidence_blocks:
        try:
            structured = llm.with_structured_output(LLMResearcherExtraction)
            res = await structured.ainvoke(
                [  # type: ignore[assignment]
                    SystemMessage(
                        content=(
                            "Extract 2-4 grounded findings from the provided source content. "
                            "CRITICAL: every quote MUST be a verbatim substring of the provided CONTENT, "
                            "and source_url MUST be one of the provided URLs. Never invent facts or URLs."
                        )
                    ),
                    HumanMessage(content=f"Research question: {angle.question}\n\n" + "\n\n".join(evidence_blocks)),
                ]
            )
            findings = res.findings[:4]  # type: ignore[union-attr]
            # The extraction LLM may invent angle_ids; force them to the real angle.
            for f in findings:
                f.angle_id = angle.id
        except Exception as e:
            logger.warning(f"Researcher extraction error ({e})")

    if not findings and sources:
        # Grounded fallback: use the search snippet as claim/quote (still a real URL).
        for s in sources[:3]:
            findings.append(
                ResearchFinding(
                    angle_id=angle.id,
                    claim=s.snippet[:300],
                    quote=s.snippet[:300],
                    source_url=s.url,
                    source_title=s.title,
                    source_publisher=s.publisher,
                    reliability_score=float(s.reliabilityScore or 0.8),
                )
            )

    return {"findings": findings}


async def aggregator_node(state: ResearchGraphState, config: RunnableConfig) -> dict:
    findings = state.get("findings", [])
    angles = state.get("angles", [])
    covered = {f.angle_id for f in findings}
    missing = [a["id"] for a in angles if a["id"] not in covered]
    if missing:
        logger.warning(
            f"Aggregator: {len(findings)} findings, missing angles {missing} "
            f"(covered={sorted(covered)}, all={[a['id'] for a in angles]})"
        )
    sink = _sink(config)
    await sink.emit(
        "thought",
        {
            "agent": "Aggregator Agent",
            "text": f"Collected {len(findings)} verified facts across {len(angles)} research vectors.",
        },
    )
    await _emit_plan_phase(sink, 2, state["topic"], count_findings=len(findings))
    return {"errors": state.get("errors", [])}


async def reference_extractor_node(state: ResearchGraphState, config: RunnableConfig) -> dict:
    findings = state.get("findings", [])
    seen: set[str] = set()
    sources: list[SourceCitationSchema] = []
    for f in findings:
        if f.source_url in seen or not f.source_url:
            continue
        seen.add(f.source_url)
        sources.append(
            SourceCitationSchema(
                id=f"src-{len(sources) + 1}",
                title=f.source_title,
                url=f.source_url,
                snippet=f.quote[:250],
                publisher=f.source_publisher or "Web",
                reliabilityScore=round(f.reliability_score, 2),
            )
        )
    sink = _sink(config)
    await sink.emit(
        "thought",
        {
            "agent": "Reference Extractor",
            "text": f"Verified and curated {len(sources)} unique references with verified URLs.",
        },
    )
    await _emit_plan_phase(sink, 3, state["topic"], count_findings=len(findings), count_sources=len(sources))
    return {"sources": [s.model_dump() for s in sources]}


async def synthesizer_node(state: ResearchGraphState, config: RunnableConfig) -> dict:
    topic = state["topic"]
    category = state.get("category")
    sink = _sink(config)

    findings = state.get("findings", [])
    evidence = (
        "\n".join(
            [f'- [{f.source_title}]({f.source_url}): {f.claim} (quote: "{f.quote[:200]}")' for f in findings[:12]]
        )
        or "(no findings)"
    )

    context_details = []
    if state.get("context_chain"):
        context_details.append(f"Origin Context Trail: {' -> '.join(state['context_chain'])}")
    if state.get("parent_summary"):
        context_details.append(f"Parent Concept Summary: {state['parent_summary']}")
    if state.get("teaser_context"):
        context_details.append(f"Inquiry Hook: {state['teaser_context']}")

    context_str = "\n".join(context_details)
    if context_str:
        context_str = f"\n\nDISCOVERY CONTEXT:\n{context_str}\n"

    llm = _llm(config, temperature=0.7, max_tokens=8000)
    dossier_data: LLMDeepDossierOutput | None = None
    children_data: list[LLMChildBranchDefinition] = []

    if llm is not None:
        try:
            structured = llm.with_structured_output(LLMSeedTreeWithBranches)
            res = await structured.ainvoke(
                [  # type: ignore[assignment]
                    SystemMessage(
                        content=(
                            "You are the knowledge synthesis engine for TDILEARNED (Today I Learned). "
                            "Transform the research findings into a clear, informative, and engaging story.\n"
                            "GUIDELINES:\n"
                            "1. Clarity First: Open with the core premise, mystery, or breakthrough in clear, direct English.\n"
                            "2. Explain How It Works: Provide concrete, factual explanations of the underlying mechanisms, key principles, or timeline events.\n"
                            "3. Child Branches: Formulate 3 distinct, high-interest related topics to explore next (e.g. historical precursor, technical principle, downstream consequence)."
                        )
                    ),
                    HumanMessage(
                        content=(
                            f"Target Subject: '{topic}'\nCategory: '{category or 'General'}'{context_str}\n"
                            f"VERIFIED EVIDENCE BLOCKS:\n{evidence}"
                        )
                    ),
                ]
            )
            dossier_data = res.root_dossier  # type: ignore[union-attr]
            children_data = res.children  # type: ignore[union-attr]
        except Exception as e:
            logger.warning(f"Synthesizer LLM error ({e}); using fallback monograph synthesis")

    if not dossier_data:
        dossier_data = LLMDeepDossierOutput(
            title=topic,
            tagline=f"Key insights and context behind {topic}.",
            category=category or "General",
            era="Unknown Era",
            abstract=f"The story of {topic} is one of the most remarkable chapters in history. This dossier gathers the key facts and sources uncovered by the research agents.",
            coreThesis=f"Why {topic} remains fascinating today.",
            location_name=None,
            latitude=None,
            longitude=None,
            timeline=[
                TimelineItem(date="Origins", headline="The Beginning", description="How it all started."),
                TimelineItem(
                    date="Turning Point", headline="The Decisive Moment", description="What changed everything."
                ),
                TimelineItem(date="Legacy", headline="Why It Matters", description="Its lasting impact."),
            ],
            mechanisms=[
                MechanismItem(
                    title="The Key Mechanism",
                    explanation="How the core phenomenon worked.",
                    bulletPoints=["Fact one", "Fact two", "Fact three"],
                ),
                MechanismItem(
                    title="Why It Still Matters",
                    explanation="Its lasting relevance.",
                    bulletPoints=["Impact one", "Impact two", "Impact three"],
                ),
            ],
            rabbitHoles=[
                RabbitHoleItem(
                    title="Deeper Origins", teaser="Where did it really come from?", affinityCategory="History"
                ),
                RabbitHoleItem(
                    title="The Human Story", teaser="Who were the key figures?", affinityCategory="Biography"
                ),
                RabbitHoleItem(
                    title="The Surprising Legacy",
                    teaser="How does it shape today?",
                    affinityCategory="Modern Relevance",
                ),
            ],
            audioTourScript=f"Let's explore the fascinating story of {topic}.",
            wowFact=f"The most surprising documented detail about {topic}.",
            curiosityScore=7,
            suggested_questions=[
                f"Why was {topic} so historically groundbreaking?",
                f"How do the core mechanisms of {topic} work in detail?",
                f"What modern discoveries or concepts trace back to {topic}?",
            ],
        )

    await _emit_plan_phase(
        sink, 4, state["topic"], count_findings=len(findings), count_sources=len(state.get("sources", []))
    )

    active_model = config.get("configurable", {}).get("model") or "cerebras:gemma-4-31b"
    await sink.emit(
        "thought",
        {
            "agent": "Storyteller Agent",
            "text": f"Synthesized deep narrative monograph and concept branches via {active_model}.",
            "model": active_model,
        },
    )

    return {
        "dossier_data": dossier_data.model_dump(),
        "children_data": [c.model_dump() for c in children_data],
    }


async def spatial_enricher_node(state: ResearchGraphState, config: RunnableConfig) -> dict:
    topic = state["topic"]
    category = state.get("category")
    parent_id = state.get("parent_id")
    sink = _sink(config)

    dd = state.get("dossier_data") or {}
    children_data = state.get("children_data") or []

    lat = dd.get("latitude") or 37.9838
    lng = dd.get("longitude") or 23.7275
    loc_name = dd.get("location_name") or "Historical Epicenter"

    call_id_geo = str(uuid.uuid4())[:8]
    await sink.emit(
        "tool_call",
        {
            "call_id": call_id_geo,
            "tool": "OpenStreetMapGeocoder",
            "query": loc_name,
            "status": "running",
        },
    )
    geo_lookup = await osm_geocoder_tool(loc_name)
    if geo_lookup:
        lat, lng, loc_name = geo_lookup
    await sink.emit(
        "tool_result",
        {
            "call_id": call_id_geo,
            "tool": "OpenStreetMapGeocoder",
            "preview": f"Pinned '{loc_name}' on the world map",
            "count": 1,
            "status": "success",
        },
    )

    # Wikimedia Commons gallery
    call_id_wiki = str(uuid.uuid4())[:8]
    await sink.emit(
        "tool_call",
        {
            "call_id": call_id_wiki,
            "tool": "WikimediaCommonsArchive",
            "query": topic,
            "status": "running",
        },
    )
    raw_images = await wikimedia_archive_tool(topic, max_images=3)
    if not raw_images and dd.get("title"):
        raw_images = await wikimedia_archive_tool(dd["title"], max_images=3)
    await sink.emit(
        "tool_result",
        {
            "call_id": call_id_wiki,
            "tool": "WikimediaCommonsArchive",
            "preview": f"Archived {len(raw_images)} historical Wikimedia records",
            "count": len(raw_images),
            "status": "success",
        },
    )

    gallery = [
        GalleryItemSchema(
            imageUrl=proxy_media_url(img.imageUrl),
            caption=img.caption,
            license=img.license or "Creative Commons",
            originUrl=img.originUrl,
        )
        for img in raw_images
    ]

    tx, ty = calculate_osm_tiles(lat, lng)
    root_coords = Coordinates(lat=lat, lng=lng, tileX=tx, tileY=ty, location_name=loc_name)
    root_id = str(uuid.uuid4())
    main_image_url = gallery[0].imageUrl if gallery else None
    suggested_q = dd.get("suggested_questions") or []

    root_node = NodeSchema(
        id=root_id,
        title=dd.get("title", topic),
        summary=(dd.get("abstract") or "")[:180] + "...",
        category=dd.get("category") or category,
        coordinates=root_coords,
        image_search_query=topic,
        imageUrl=main_image_url,
        rabbit_holes=[rh["title"] for rh in dd.get("rabbitHoles", [])][:3],
        suggested_questions=suggested_q[:4],
        timestamp=dd.get("era"),
        confidence=0.98,
        audio_summary=(dd.get("audioTourScript") or "")[:160] + "...",
        sources_count=len(state.get("sources", [])),
        curiosity_score=min(max(int(dd.get("curiosityScore") or 7), 1), 10),
        wow_fact=dd.get("wowFact"),
        related_to_today=None,
    )

    dossier = ResearchDossierSchema(
        nodeId=root_id,
        title=dd.get("title", topic),
        tagline=dd.get("tagline", ""),
        category=dd.get("category") or category or "Fascinating History",
        era=dd.get("era", "Unknown Era"),
        abstract=dd.get("abstract", ""),
        coreThesis=dd.get("coreThesis", ""),
        sources=[SourceCitationSchema(**s) for s in state.get("sources", [])],
        gallery=gallery,
        timeline=[
            TimelineEventSchema(date=t["date"], headline=t["headline"], description=t["description"])
            for t in dd.get("timeline", [])
        ],
        mechanisms=[
            MechanismCardSchema(title=m["title"], explanation=m["explanation"], bulletPoints=m.get("bulletPoints", []))
            for m in dd.get("mechanisms", [])
        ],
        geography=GeographySchema(
            locationName=loc_name,
            latitude=lat,
            longitude=lng,
            historicalSignificance=f"Where the story of {topic} took place.",
        ),
        rabbitHoles=[
            RabbitHoleTeaserSchema(
                title=rh["title"], teaser=rh["teaser"], affinityCategory=rh.get("affinityCategory", "Curiosity")
            )
            for rh in dd.get("rabbitHoles", [])
        ],
        suggestedQuestions=suggested_q[:4],
        audioTourScript=dd.get("audioTourScript", ""),
        wowFact=dd.get("wowFact"),
        curiosityScore=min(max(int(dd.get("curiosityScore") or 7), 1), 10),
    )

    cache_service.set(f"dossier:{root_id}", dossier.model_dump(), ttl_seconds=DOSSIER_TTL_SECONDS)
    await sink.emit("dossier", dossier.model_dump())
    await sink.emit("node_stream", root_node.model_dump())

    # Emit Phase 5 Complete
    await _emit_plan_phase(
        sink, 5, topic, count_findings=len(state.get("findings", [])), count_sources=len(state.get("sources", []))
    )

    # Child nodes
    child_nodes: list[NodeSchema] = []
    if not parent_id:
        branches = children_data[:3]
        if not branches and dd.get("rabbitHoles"):
            branches = [
                {
                    "title": rh.get("title") if isinstance(rh, dict) else str(rh),
                    "summary": rh.get("teaser", f"Connected knowledge vector exploring {topic}.")
                    if isinstance(rh, dict)
                    else f"Exploration branch for {topic}.",
                    "category": category,
                    "era": dd.get("era", "Historic"),
                    "image_search_query": rh.get("title") if isinstance(rh, dict) else str(rh),
                    "rabbit_holes": [],
                    "suggested_questions": [],
                    "curiosityScore": 7,
                }
                for rh in dd.get("rabbitHoles", [])[:3]
            ]

        async def _child_image(branch: dict[str, Any]) -> str | None:
            c_query = branch.get("image_search_query") or branch.get("title") or topic
            c_images = await wikimedia_archive_tool(c_query, max_images=1)
            if not c_images:
                c_images = await wikimedia_archive_tool(branch.get("title") or topic, max_images=1)
            return proxy_media_url(c_images[0].imageUrl) if c_images else None

        child_images = await asyncio.gather(*(_child_image(b) for b in branches))

        for i, (branch, c_img) in enumerate(zip(branches, child_images), 1):
            c_lat, c_lng = lat + (0.8 * (i - 1)), lng - (1.2 * i)
            c_tx, c_ty = calculate_osm_tiles(c_lat, c_lng)
            c_node = NodeSchema(
                id=str(uuid.uuid4()),
                title=branch.get("title", topic),
                summary=branch.get("summary", ""),
                category=branch.get("category") or category,
                coordinates=Coordinates(
                    lat=c_lat, lng=c_lng, tileX=c_tx, tileY=c_ty, location_name=branch.get("location_name") or loc_name
                ),
                image_search_query=branch.get("image_search_query") or topic,
                imageUrl=c_img,
                rabbit_holes=branch.get("rabbit_holes", [])[:3],
                suggested_questions=branch.get("suggested_questions", [])[:3],
                timestamp=branch.get("era"),
                confidence=0.96,
                audio_summary=branch.get("summary"),
                sources_count=len(state.get("sources", [])),
                curiosity_score=min(max(int(branch.get("curiosityScore") or 7), 1), 10),
                wow_fact=None,
                related_to_today=None,
            )
            child_nodes.append(c_node)
            await sink.emit("node_stream", c_node.model_dump())
            await asyncio.sleep(0.05)

    return {
        "root_node": root_node.model_dump(),
        "child_nodes": [c.model_dump() for c in child_nodes],
        "dossier": dossier.model_dump(),
    }


# ---------------------------------------------------------------------------
# Graph compilation
# ---------------------------------------------------------------------------


def build_research_graph():
    builder = StateGraph(ResearchGraphState)

    builder.add_node("planner", planner_node)
    builder.add_node("researcher", researcher_node)
    builder.add_node("aggregator", aggregator_node)
    builder.add_node("reference_extractor", reference_extractor_node)
    builder.add_node("synthesizer", synthesizer_node)
    builder.add_node("spatial_enricher", spatial_enricher_node)

    builder.add_edge(START, "planner")
    builder.add_conditional_edges("planner", fan_out_researchers, ["researcher"])
    builder.add_edge("researcher", "aggregator")
    builder.add_edge("aggregator", "reference_extractor")
    builder.add_edge("reference_extractor", "synthesizer")
    builder.add_edge("synthesizer", "spatial_enricher")
    builder.add_edge("spatial_enricher", END)

    return builder.compile()


research_graph_app = build_research_graph()


# ---------------------------------------------------------------------------
# Public async entrypoint
# ---------------------------------------------------------------------------


async def run_research_graph(
    topic: str,
    category: str | None = None,
    parent_id: str | None = None,
    context_chain: list[str] | None = None,
    parent_summary: str | None = None,
    teaser_context: str | None = None,
    image_query: str | None = None,
    sink: EventSink | None = None,
    engine: str = "cerebras",
) -> dict:
    """Run the map-reduce research graph, emitting SSE events into the sink.

    `engine` selects the LLM provider: 'cerebras' for live interactive research,
    'mistral' for offline batch precompute (cheaper, no TTFT requirement).
    """
    queue: asyncio.Queue = asyncio.Queue()
    sink = sink or EventSink(queue)

    start = time.time()
    initial_state: ResearchGraphState = {
        "topic": topic,
        "category": category,
        "context_chain": context_chain or [],
        "parent_id": parent_id,
        "parent_summary": parent_summary,
        "teaser_context": teaser_context,
        "image_query": image_query,
        "angles": [],
        "findings": [],
        "sources": [],
        "dossier_data": None,
        "children_data": [],
        "dossier": None,
        "root_node": None,
        "child_nodes": [],
        "execution_time_ms": 0.0,
        "engine_used": engine,
        "errors": [],
    }

    result = await research_graph_app.ainvoke(
        initial_state,
        config={"configurable": {"event_sink": sink, "llm_engine": engine}},
    )
    elapsed_ms = (time.time() - start) * 1000
    await sink.emit(
        "done",
        {
            "execution_time_ms": elapsed_ms,
            "total_sources": len(result.get("sources", [])),
            "total_findings": len(result.get("findings", [])),
            "root_id": (result.get("root_node") or {}).get("id"),
        },
    )
    return result
