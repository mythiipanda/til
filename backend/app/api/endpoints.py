import logging
import time

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.schemas.graph import (
    PrecomputedHubSchema,
    PrecomputedHubSummarySchema,
    RandomTopicResponse,
    ResearchDossierSchema,
)
from app.services.chat_agent import stream_chat
from app.services.precompute import get_precomputed_hub, list_precomputed_hubs
from app.services.random_topic import pick_random_topic
from app.services.research_agent import get_dossier, stream_deep_research

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["Research & Graph Discovery"])


@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "Agentic Deep Research & Curiosity Engine Backend",
        "inference_engine": "Cerebras (map-reduce research graph + ReAct follow-up chat)",
        "multi_agent_framework": "LangGraph (Planner, Parallel Researchers, Aggregator, Extractor, Synthesizer)",
        "cache_type": "Redis / In-Memory",
        "version": "2.1.0",
    }


@router.get("/graph/random-topic", response_model=RandomTopicResponse)
async def random_topic(
    category: str = Query("History", description="One of: Science, History, Mathematics, Technology, Philosophy"),
):
    """Pick a curiosity-worthy random topic from a category (AI-powered random Wikipedia)."""
    start_time = time.time()
    result = await pick_random_topic(category)
    result.node.sources_count = 0
    result.node.curiosity_score = None
    result.node.rabbit_holes = []
    logger.info(f"[random-topic] {category} -> '{result.node.title}' in {(time.time() - start_time) * 1000:.0f}ms")
    return result


@router.get("/graph/precomputed", response_model=list[PrecomputedHubSummarySchema])
async def list_precomputed():
    """List fully-researched hubs that render instantly (precomputed offline)."""
    return list_precomputed_hubs()


@router.get("/graph/precomputed/{hub_id}", response_model=PrecomputedHubSchema)
async def get_precomputed(hub_id: str):
    """Fetch a fully-researched hub (root node + child branches) by id."""
    hub = get_precomputed_hub(hub_id)
    if hub is None:
        raise HTTPException(status_code=404, detail="Precomputed hub not found")
    return hub


@router.get("/research/stream")
async def research_stream_endpoint(
    topic: str = Query(..., description="Research inquiry topic"),
    category: str = Query(None, description="Optional category classification"),
    parent_id: str = Query(None, description="Optional parent node ID for expansion"),
):
    """
    Manus-grade Server-Sent Events (SSE) stream:
    Emits real-time Plan DAG steps, agent thoughts, active tool calls,
    discovered sources, incremental React Flow nodes, and full interactive dossiers.
    """
    return StreamingResponse(
        stream_deep_research(topic, category, parent_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


@router.get("/research/dossier/{node_id}", response_model=ResearchDossierSchema)
async def get_research_dossier(node_id: str):
    """Retrieve full website-style research dossier for a node."""
    dossier = get_dossier(node_id)
    if dossier is None:
        raise HTTPException(status_code=404, detail="Research dossier not found for this node ID")
    return dossier


@router.get("/chat/stream")
async def chat_stream_endpoint(
    node_title: str = Query(..., description="Active node concept title"),
    question: str = Query(..., description="User question"),
    ancestors: str = Query("", description="Comma-separated ancestor node trail"),
):
    """Server-Sent Events (SSE) streaming endpoint for Cerebras conversational follow-ups."""
    context_list = [a.strip() for a in ancestors.split(",") if a.strip()]
    return StreamingResponse(
        stream_chat(node_title, question, context_list),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )
