import logging
import time

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.api.middleware.rate_limit import chat_rate_limiter, research_rate_limiter
from app.schemas.graph import (
    PrecomputedHubSchema,
    PrecomputedHubSummarySchema,
    RandomTopicResponse,
    ResearchDossierSchema,
)
from app.services.catalog import get_catalog
from app.services.chat_agent import stream_chat
from app.services.precompute import get_precomputed_hub, list_precomputed_hubs
from app.services.random_topic import pick_random_topic
from app.services.research_agent import get_dossier, stream_deep_research

from app.services.supabase import fetch_hub_by_id_from_supabase, fetch_hubs_from_supabase, is_supabase_configured

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["Research & Graph Discovery"])


@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "TDILEARNED (Today I Learned) Backend",
        "inference_engine": "Cerebras (map-reduce research graph + ReAct follow-up chat)",
        "multi_agent_framework": "LangGraph (Planner, Parallel Researchers, Aggregator, Extractor, Synthesizer)",
        "cache_type": "Supabase Postgres / Edge CDN",
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


@router.get("/graph/catalog")
async def list_catalog(limit: int = Query(2000, ge=1, le=3000)):
    """List hundreds of pre-curated real Wikipedia topics for instant browsing."""
    catalog = get_catalog()
    supabase_hubs = await fetch_hubs_from_supabase(limit=limit) if is_supabase_configured() else []
    
    existing_titles = {t["title"].lower().strip() for t in (catalog or [])}
    
    hub_entries = [
        {
            "id": h["id"],
            "title": h["topic"],
            "summary": h.get("summary", ""),
            "category": h.get("category", "General"),
            "precomputed": True,
        }
        for h in supabase_hubs
    ]
    
    merged = hub_entries + [t for t in (catalog or []) if t.get("title", "").lower().strip() not in existing_titles]
    return {"total": len(merged), "topics": merged[:limit]}


@router.get("/graph/precomputed", response_model=list[PrecomputedHubSummarySchema])
async def list_precomputed():
    """List fully-researched hubs that render instantly (loaded directly from Supabase)."""
    if is_supabase_configured():
        supabase_hubs = await fetch_hubs_from_supabase(limit=2000)
        if supabase_hubs:
            return supabase_hubs
    return list_precomputed_hubs()


@router.get("/graph/precomputed/{hub_id}", response_model=PrecomputedHubSchema)
async def get_precomputed(hub_id: str):
    """Fetch a fully-researched hub (root node + child branches) by id from Supabase."""
    if is_supabase_configured():
        hub = await fetch_hub_by_id_from_supabase(hub_id)
        if hub is not None:
            try:
                return PrecomputedHubSchema(**hub)
            except Exception as e:
                logger.warning(f"Failed to parse Supabase hub {hub_id}: {e}")

    hub = get_precomputed_hub(hub_id)
    if hub is None:
        raise HTTPException(status_code=404, detail="Precomputed hub not found")
    return hub


@router.get("/research/stream", dependencies=[Depends(research_rate_limiter)])
async def research_stream_endpoint(
    topic: str = Query(..., description="Research inquiry topic"),
    category: str = Query(None, description="Optional category classification"),
    parent_id: str = Query(None, description="Optional parent node ID for expansion"),
    context_chain: str = Query("", description="Comma-separated chain of parent topics"),
    parent_summary: str = Query(None, description="Summary of parent node"),
    teaser_context: str = Query(None, description="Teaser or hook of subtopic"),
):
    """
    Manus-grade Server-Sent Events (SSE) stream:
    Emits real-time Plan DAG steps, agent thoughts, active tool calls,
    discovered sources, incremental React Flow nodes, and full interactive dossiers.
    """
    context_list = [c.strip() for c in context_chain.split(",") if c.strip()]
    return StreamingResponse(
        stream_deep_research(
            topic=topic,
            category=category,
            parent_id=parent_id,
            context_chain=context_list,
            parent_summary=parent_summary,
            teaser_context=teaser_context,
        ),
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


@router.get("/chat/stream", dependencies=[Depends(chat_rate_limiter)])
async def chat_stream_endpoint(
    node_title: str = Query(..., description="Active node concept title"),
    question: str = Query(..., description="User question"),
    ancestors: str = Query("", description="Comma-separated ancestor node trail"),
    history: str = Query("", description="JSON-encoded previous conversation turns"),
    active_summary: str = Query(None, description="Summary of active node"),
):
    """Server-Sent Events (SSE) streaming endpoint for Cerebras conversational follow-ups."""
    context_list = [a.strip() for a in ancestors.split(",") if a.strip()]
    history_list = []
    if history:
        try:
            import json

            parsed = json.loads(history)
            if isinstance(parsed, list):
                history_list = parsed
        except Exception:
            pass

    return StreamingResponse(
        stream_chat(
            node_title=node_title,
            user_question=question,
            ancestor_context=context_list,
            history=history_list,
            active_summary=active_summary,
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )
