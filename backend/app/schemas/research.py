"""
Map-Reduce Deep Research schemas.

These model the data contract for the planner → parallel researchers →
reference extraction → synthesis pipeline. Findings flow through the graph
with an operator.add reducer (LangGraph) so parallel researchers never
overwrite each other.
"""

import operator
from typing import Annotated, TypedDict

from pydantic import BaseModel, Field

from app.schemas.graph import ResearchDossierSchema


class ResearchAngle(BaseModel):
    """A single targeted research angle/sub-question produced by the planner."""

    id: str = Field(description="Short stable id, e.g. 'angle-1'")
    question: str = Field(description="Specific research question or angle to investigate")
    rationale: str = Field(description="Why this angle matters, in one punchy sentence")


class ResearchPlan(BaseModel):
    """The planner's decomposition of the topic into research angles."""

    angles: list[ResearchAngle] = Field(description="3-5 targeted, non-overlapping research angles")


class ResearchFinding(BaseModel):
    """A grounded finding produced by a sub-researcher. Only real URLs, no fabrication."""

    angle_id: str = Field(description="The research angle this finding answers")
    claim: str = Field(description="The extracted key fact, in simple language")
    quote: str = Field(description="Verbatim quote from the source supporting the claim")
    source_url: str = Field(description="The real URL the quote was extracted from")
    source_title: str = Field(description="Page/article title of the source")
    source_publisher: str | None = Field(None, description="Publisher or domain of the source")
    reliability_score: float = Field(default=0.8, ge=0.0, le=1.0)


class ResearchGraphState(TypedDict):
    """LangGraph state for the map-reduce research workflow."""

    topic: str
    category: str | None
    context_chain: list[str]
    parent_id: str | None
    parent_summary: str | None
    teaser_context: str | None
    image_query: str | None
    angles: list[dict]
    findings: Annotated[list[ResearchFinding], operator.add]
    sources: list[dict]
    dossier_data: dict | None
    children_data: list[dict]
    dossier: ResearchDossierSchema | None
    root_node: dict | None
    child_nodes: list[dict]
    execution_time_ms: float
    engine_used: str
    errors: list[str]
