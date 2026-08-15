from pydantic import BaseModel, Field


class Coordinates(BaseModel):
    lat: float
    lng: float
    tileX: int | None = None
    tileY: int | None = None
    location_name: str | None = None


class NodeSchema(BaseModel):
    id: str
    title: str
    summary: str
    category: str | None = "General"
    coordinates: Coordinates | None = None
    image_search_query: str
    imageUrl: str | None = None
    rabbit_holes: list[str] = Field(description="3 downstream exploration vectors")
    timestamp: str | None = "Historical Era"
    confidence: float | None = 0.95
    audio_summary: str | None = None
    sources_count: int | None = 0
    curiosity_score: int | None = Field(default=None, ge=1, le=10, description="How mind-blowing is this topic?")
    wow_fact: str | None = Field(default=None, description="The single most surprising sentence about this topic")
    related_to_today: str | None = Field(default=None, description="Current-events connection, or None")


class RandomTopicResponse(BaseModel):
    """A curiosity-worthy random topic drawn from a category's pool + live signals."""

    node: NodeSchema
    reason: str = Field(description="Why this topic is worth diving into, in one punchy sentence")
    category: str


class SourceCitationSchema(BaseModel):
    id: str
    title: str
    url: str
    snippet: str
    publisher: str | None = "Academic / Archival Record"
    publishedDate: str | None = None
    reliabilityScore: float | None = 0.92


class GalleryItemSchema(BaseModel):
    imageUrl: str
    caption: str
    license: str | None = "Creative Commons"
    originUrl: str | None = None


class TimelineEventSchema(BaseModel):
    date: str
    headline: str
    description: str


class MechanismCardSchema(BaseModel):
    title: str
    explanation: str
    bulletPoints: list[str] = []


class GeographySchema(BaseModel):
    locationName: str
    latitude: float
    longitude: float
    historicalSignificance: str


class RabbitHoleTeaserSchema(BaseModel):
    title: str
    teaser: str
    affinityCategory: str


class ResearchDossierSchema(BaseModel):
    nodeId: str
    title: str
    tagline: str
    category: str
    era: str
    abstract: str
    coreThesis: str
    sources: list[SourceCitationSchema] = []
    gallery: list[GalleryItemSchema] = []
    timeline: list[TimelineEventSchema] = []
    mechanisms: list[MechanismCardSchema] = []
    geography: GeographySchema | None = None
    rabbitHoles: list[RabbitHoleTeaserSchema] = []
    audioTourScript: str
    wowFact: str | None = None
    curiosityScore: int | None = Field(default=None, ge=1, le=10)


class PlanStepSchema(BaseModel):
    id: str
    title: str
    agent: str
    status: str = "pending"  # pending | running | done


class PrecomputedHubSchema(BaseModel):
    """A fully-researched topic: root node + its child branches, ready to render instantly."""

    id: str
    topic: str
    category: str
    root: NodeSchema
    children: list[NodeSchema] = []


class PrecomputedHubSummarySchema(BaseModel):
    """Lightweight index entry for a precomputed hub (for listing endpoints)."""

    id: str
    topic: str
    category: str
    imageUrl: str | None = None
    summary: str = ""
