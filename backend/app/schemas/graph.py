from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class Coordinates(BaseModel):
    lat: float = Field(..., description="Latitude coordinate")
    lng: float = Field(..., description="Longitude coordinate")
    tileX: Optional[int] = None
    tileY: Optional[int] = None
    location_name: Optional[str] = None

class NodeSchema(BaseModel):
    id: str = Field(..., description="Unique UUID identifier for node")
    title: str = Field(..., description="Short concept title")
    summary: str = Field(..., max_length=300, description="Concise 2-sentence context summary")
    category: Optional[str] = "General Discovery"
    coordinates: Optional[Coordinates] = None
    image_search_query: str = Field(..., description="Search query for Wikimedia Commons")
    imageUrl: Optional[str] = None
    rabbit_holes: List[str] = Field(..., min_length=3, max_length=3, description="3 curated downstream sub-topics")
    timestamp: Optional[str] = Field(None, description="Historical era or chronological timestamp")
    confidence: Optional[float] = 0.96
    audio_summary: Optional[str] = None

class SeedRequest(BaseModel):
    topic: str = Field(..., description="Category driver or natural language prompt")
    category: Optional[str] = None

class NodeExpansionRequest(BaseModel):
    parent_id: str = Field(..., description="Parent node ID")
    topic: str = Field(..., description="Chosen rabbit hole sub-topic")
    context_chain: List[str] = Field(default_factory=list, description="Ancestor concept titles for context")
    category: Optional[str] = None

class GraphTreeResponse(BaseModel):
    parent_id: str
    nodes: List[NodeSchema]
    execution_time_ms: float
    engine_used: str
    is_cached: bool = False

class ChatStreamRequest(BaseModel):
    node_id: str
    node_title: str
    user_question: str
    ancestor_context: List[str] = Field(default_factory=list)
