"""
LangGraph Research & Discovery Workflow
Uses OpenAI-compatible ChatOpenAI with Cerebras/Mistral and LangGraph
to orchestrate structured node synthesis, Wikimedia enrichment, and OSM geocoding.
"""

import os
import time
import uuid
import asyncio
import logging
from typing import Dict, Any, List, Optional, TypedDict, Tuple
from pydantic import BaseModel, Field

from langchain_core.messages import SystemMessage, HumanMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, START, END

from app.schemas.graph import NodeSchema, Coordinates, GraphTreeResponse
from app.services.media import fetch_wikimedia_thumbnail, calculate_osm_tiles

logger = logging.getLogger(__name__)

# Structured Pydantic models for LangChain .with_structured_output()
# Note: Cerebras JSON schema compiler does not accept minItems/maxItems on arrays
class RawNodeDefinition(BaseModel):
    title: str = Field(description="Short concept label")
    summary: str = Field(description="Concise 2-sentence context summary")
    category: str = Field(description="Broad category classification")
    latitude: Optional[float] = Field(None, description="Latitude coordinate if applicable")
    longitude: Optional[float] = Field(None, description="Longitude coordinate if applicable")
    location_name: Optional[str] = Field(None, description="Name of the city, region or observatory")
    image_search_query: str = Field(description="Exact search keyword for Wikimedia Commons archives")
    rabbit_holes: List[str] = Field(description="Exactly 3 downstream exploration vectors")
    timestamp: Optional[str] = Field(None, description="Historical era or year (e.g., '1518 CE', 'c. 300 BCE')")
    audio_summary: Optional[str] = Field(None, description="2-sentence podcast-style narration")

class SeedTreeStructuredOutput(BaseModel):
    root: RawNodeDefinition
    children: List[RawNodeDefinition] = Field(description="Exactly 3 child branch nodes")

class ExpansionTreeStructuredOutput(BaseModel):
    nodes: List[RawNodeDefinition] = Field(description="Exactly 3 downstream rabbit hole nodes")

# LangGraph State Schema
class DiscoveryAgentState(TypedDict):
    task_type: str # 'seed' or 'expand'
    topic: str
    category: Optional[str]
    parent_id: Optional[str]
    context_chain: List[str]
    raw_result: Optional[Dict[str, Any]]
    final_nodes: List[NodeSchema]
    engine_used: str
    execution_time_ms: float

def get_cerebras_chat_model():
    api_key = os.getenv("CEREBRAS_API_KEY")
    model_name = os.getenv("CEREBRAS_MODEL", "gemma-4-31b")
    if not api_key:
        return None
    return ChatOpenAI(
        model=model_name,
        api_key=api_key,
        base_url="https://api.cerebras.ai/v1",
        temperature=0.7,
        max_tokens=1500,
        default_headers={"X-Cerebras-3rd-Party-Integration": "infinite-curiosity-langgraph"}
    )

# --- LangGraph Nodes ---

async def synthesize_concepts_node(state: DiscoveryAgentState) -> Dict[str, Any]:
    """Node 1: Invoke LLM to synthesize knowledge structures."""
    llm = get_cerebras_chat_model()
    task_type = state["task_type"]
    topic = state["topic"]
    category = state.get("category") or "General Discovery"
    context = state.get("context_chain") or []

    if not llm:
        return {"engine_used": "local-synthesizer"}

    try:
        if task_type == "seed":
            structured_llm = llm.with_structured_output(SeedTreeStructuredOutput)
            sys_prompt = (
                "You are the Curiosity MindMap Synthesizer. "
                "Generate a rich, structured discovery tree containing exactly 1 root node and 3 distinct child branches. "
                "Each node must have exactly 3 rabbit_holes."
            )
            user_prompt = f"Topic: '{topic}'. Category: '{category}'."
            result: SeedTreeStructuredOutput = await structured_llm.ainvoke([
                SystemMessage(content=sys_prompt),
                HumanMessage(content=user_prompt)
            ])
            return {
                "raw_result": result.model_dump(),
                "engine_used": f"cerebras-{os.getenv('CEREBRAS_MODEL', 'gemma-4-31b')}"
            }
        else:
            structured_llm = llm.with_structured_output(ExpansionTreeStructuredOutput)
            sys_prompt = (
                "You are the Curiosity MindMap Synthesizer. "
                "Generate exactly 3 downstream rabbit hole deep-dive nodes for this subtopic. "
                "Each node must have exactly 3 rabbit_holes."
            )
            user_prompt = f"Subtopic: '{topic}'. Ancestor Context: {' -> '.join(context)}."
            result: ExpansionTreeStructuredOutput = await structured_llm.ainvoke([
                SystemMessage(content=sys_prompt),
                HumanMessage(content=user_prompt)
            ])
            return {
                "raw_result": result.model_dump(),
                "engine_used": f"cerebras-{os.getenv('CEREBRAS_MODEL', 'gemma-4-31b')}"
            }
    except Exception as e:
        logger.warning(f"LangGraph LLM synthesis error ({e}), using fallback synthesizer")
        return {"engine_used": "local-synthesizer"}

async def enrich_media_and_geo_node(state: DiscoveryAgentState) -> Dict[str, Any]:
    """Node 2: Enrich nodes with Wikimedia Commons artwork and OpenStreetMap coordinates."""
    raw = state.get("raw_result")
    task_type = state["task_type"]
    topic = state["topic"]

    node_defs: List[Dict[str, Any]] = []
    if raw:
        if task_type == "seed" and "root" in raw and "children" in raw:
            node_defs = [raw["root"]] + raw["children"]
        elif task_type == "expand" and "nodes" in raw:
            node_defs = raw["nodes"]

    if not node_defs:
        from app.services.inference import DynamicKnowledgeSynthesizer
        if task_type == "seed":
            root_s, children_s = DynamicKnowledgeSynthesizer.synthesize_seed(topic, state.get("category"))
            final_nodes = [root_s] + children_s
        else:
            final_nodes = DynamicKnowledgeSynthesizer.synthesize_expansion(
                state.get("parent_id", "root"), topic, state.get("context_chain", [])
            )
        tasks = [fetch_wikimedia_thumbnail(n.image_search_query) for n in final_nodes]
        images = await asyncio.gather(*tasks, return_exceptions=True)
        for n, img in zip(final_nodes, images):
            if isinstance(img, str) and img:
                n.imageUrl = img
        return {"final_nodes": final_nodes}

    final_nodes: List[NodeSchema] = []
    image_tasks = []

    for d in node_defs:
        coords = None
        lat = d.get("latitude")
        lng = d.get("longitude")
        if lat is not None and lng is not None:
            tx, ty = calculate_osm_tiles(lat, lng)
            coords = Coordinates(
                lat=lat,
                lng=lng,
                tileX=tx,
                tileY=ty,
                location_name=d.get("location_name")
            )

        node = NodeSchema(
            id=str(uuid.uuid4()),
            title=d.get("title", topic),
            summary=d.get("summary", ""),
            category=d.get("category", state.get("category", "General")),
            coordinates=coords,
            image_search_query=d.get("image_search_query", topic),
            rabbit_holes=d.get("rabbit_holes", ["Vector 1", "Vector 2", "Vector 3"])[:3],
            timestamp=d.get("timestamp", "Historical Era"),
            confidence=0.97,
            audio_summary=d.get("audio_summary", d.get("summary"))
        )
        final_nodes.append(node)
        image_tasks.append(fetch_wikimedia_thumbnail(node.image_search_query))

    images = await asyncio.gather(*image_tasks, return_exceptions=True)
    for node, img in zip(final_nodes, images):
        if isinstance(img, str) and img:
            node.imageUrl = img

    return {"final_nodes": final_nodes}

def build_discovery_graph():
    builder = StateGraph(DiscoveryAgentState)
    builder.add_node("synthesize", synthesize_concepts_node)
    builder.add_node("enrich", enrich_media_and_geo_node)

    builder.add_edge(START, "synthesize")
    builder.add_edge("synthesize", "enrich")
    builder.add_edge("enrich", END)

    return builder.compile()

discovery_graph_app = build_discovery_graph()

async def run_discovery_workflow(
    task_type: str,
    topic: str,
    category: Optional[str] = None,
    parent_id: Optional[str] = None,
    context_chain: List[str] = []
) -> Tuple[List[NodeSchema], str, float]:
    """Execute the compiled LangGraph workflow."""
    start_time = time.time()
    initial_state: DiscoveryAgentState = {
        "task_type": task_type,
        "topic": topic,
        "category": category,
        "parent_id": parent_id,
        "context_chain": context_chain,
        "raw_result": None,
        "final_nodes": [],
        "engine_used": "langgraph-agent",
        "execution_time_ms": 0.0,
    }

    result = await discovery_graph_app.ainvoke(initial_state)
    elapsed = (time.time() - start_time) * 1000
    engine = result.get("engine_used", "langgraph-agent")
    return result["final_nodes"], engine, elapsed
