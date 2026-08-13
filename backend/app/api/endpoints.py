import time
import json
import logging
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.schemas.graph import (
    SeedRequest,
    NodeExpansionRequest,
    GraphTreeResponse,
    NodeSchema,
    Coordinates,
)
from app.services.cache import cache_service
from app.services.inference import inference_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["Graph & Chat"])

@router.post("/graph/seed", response_model=GraphTreeResponse)
async def seed_graph(request: SeedRequest):
    """
    Build or fetch a seed knowledge graph tree containing 1 root node and 3 primary child nodes.
    Checks precomputed / Redis cache first for 0ms retrieval.
    """
    start_time = time.time()
    cache_key = cache_service.get_seed_key(request.topic)
    cached = cache_service.get(cache_key)

    if cached and "root" in cached and "children" in cached:
        root = NodeSchema(**cached["root"])
        children = [NodeSchema(**c) for c in cached["children"]]
        elapsed = (time.time() - start_time) * 1000
        return GraphTreeResponse(
            parent_id="root",
            nodes=[root] + children,
            execution_time_ms=round(elapsed, 2),
            engine_used="precomputed-cache",
            is_cached=True,
        )

    # Uncached: invoke Cerebras inference
    root_node, child_nodes, engine, elapsed = await inference_service.generate_seed(
        topic=request.topic, category=request.category
    )

    # Store in cache
    cache_service.set(
        cache_key,
        {
            "root": root_node.model_dump(),
            "children": [c.model_dump() for c in child_nodes],
        },
    )

    return GraphTreeResponse(
        parent_id="root",
        nodes=[root_node] + child_nodes,
        execution_time_ms=round(elapsed, 2),
        engine_used=engine,
        is_cached=False,
    )

@router.post("/graph/expand", response_model=GraphTreeResponse)
async def expand_graph(request: NodeExpansionRequest):
    """
    Expand downstream 'rabbit hole' branches from a selected topic.
    Checks cache first, then invokes Cerebras for high-speed sub-node generation.
    """
    start_time = time.time()
    cache_key = cache_service.get_expansion_key(request.parent_id, request.topic)
    cached = cache_service.get(cache_key)

    if cached and "nodes" in cached:
        nodes = [NodeSchema(**n) for n in cached["nodes"]]
        elapsed = (time.time() - start_time) * 1000
        return GraphTreeResponse(
            parent_id=request.parent_id,
            nodes=nodes,
            execution_time_ms=round(elapsed, 2),
            engine_used="precomputed-cache",
            is_cached=True,
        )

    # Uncached: invoke Cerebras inference
    nodes, engine, elapsed = await inference_service.generate_expansion(
        parent_id=request.parent_id,
        topic=request.topic,
        context_chain=request.context_chain,
    )

    # Store in cache
    cache_service.set(cache_key, {"nodes": [n.model_dump() for n in nodes]})

    return GraphTreeResponse(
        parent_id=request.parent_id,
        nodes=nodes,
        execution_time_ms=round(elapsed, 2),
        engine_used=engine,
        is_cached=False,
    )

@router.get("/chat/stream")
async def chat_stream(
    node_id: str = Query(..., description="Target node ID"),
    node_title: str = Query(..., description="Target node title"),
    user_question: str = Query(..., description="User question or follow-up"),
    context: Optional[str] = Query(None, description="Comma-separated ancestor context"),
):
    """
    Server-Sent Events (SSE) streaming endpoint for conversational follow-ups.
    Streams tokens in real time from Cerebras.
    """
    ancestor_context = [c.strip() for c in context.split(",")] if context else []
    return StreamingResponse(
        inference_service.stream_chat(
            node_title=node_title,
            user_question=user_question,
            ancestor_context=ancestor_context,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        },
    )

@router.get("/health")
async def health_check():
    """Health and engine status endpoint."""
    return {
        "status": "healthy",
        "service": "Infinite Curiosity Engine Backend",
        "inference_engine": "Cerebras CS-3 / Llama-3.3-70B",
        "batch_precompute_engine": "Mistral AI",
        "cache_type": "Redis / In-Memory Multitier",
        "version": "1.0.0",
    }
