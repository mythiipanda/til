"""Research + graph schema model tests."""

import pytest
from pydantic import ValidationError

from app.schemas.graph import (
    Coordinates,
    GalleryItemSchema,
    MechanismCardSchema,
    NodeSchema,
    PlanStepSchema,
    PrecomputedHubSchema,
    RabbitHoleTeaserSchema,
    ResearchDossierSchema,
    SourceCitationSchema,
    TimelineEventSchema,
)
from app.schemas.research import ResearchAngle, ResearchFinding, ResearchGraphState, ResearchPlan


def test_research_angle_roundtrip():
    a = ResearchAngle(id="angle-1", question="How did X work?", rationale="Core mechanism.")
    assert a.id == "angle-1"


def test_research_plan_requires_angles():
    with pytest.raises(ValidationError):
        ResearchPlan()  # missing required field
    # empty list is permitted by the schema (app-level logic guards it)
    assert ResearchPlan(angles=[]).angles == []


def test_research_finding_defaults():
    f = ResearchFinding(
        angle_id="a",
        claim="claim",
        quote="quote",
        source_url="https://x",
        source_title="t",
    )
    assert f.reliability_score == 0.8
    assert f.source_publisher is None


def test_research_finding_rejects_out_of_range_reliability():
    with pytest.raises(ValidationError):
        ResearchFinding(
            angle_id="a",
            claim="c",
            quote="q",
            source_url="https://x",
            source_title="t",
            reliability_score=1.5,
        )


def test_graph_state_typed_dict_keys():
    keys = set(ResearchGraphState.__annotations__.keys())
    assert {
        "topic",
        "findings",
        "angles",
        "dossier_data",
        "children_data",
        "dossier",
        "root_node",
        "child_nodes",
        "errors",
    }.issubset(keys)


def test_node_schema_defaults():
    n = NodeSchema(id="n1", title="Antikythera mechanism", summary="Ancient computer")
    assert n.category == "General"
    assert n.confidence == 0.95
    assert n.rabbit_holes == []
    assert n.sources_count == 0


def test_node_schema_clamps_curiosity_score():
    n = NodeSchema(id="n1", title="t", summary="s", curiosity_score=7)
    assert n.curiosity_score == 7
    with pytest.raises(ValidationError):
        NodeSchema(id="n1", title="t", summary="s", curiosity_score=99)  # out of 1..10 range


def test_source_citation_defaults():
    s = SourceCitationSchema(id="s", title="t", url="https://x", snippet="snip")
    assert s.publisher == "Academic / Archival Record"
    assert s.reliabilityScore == 0.92


def test_dossier_schema_defaults():
    d = ResearchDossierSchema()
    assert d.nodeId == ""
    assert d.category == "General"
    assert d.sources == []


def test_dossier_full_construction():
    d = ResearchDossierSchema(
        nodeId="n1",
        title="T",
        sources=[SourceCitationSchema(id="s", title="st", url="https://u", snippet="q")],
        gallery=[GalleryItemSchema(imageUrl="https://i", caption="c")],
        timeline=[TimelineEventSchema(date="1", headline="h", description="d")],
        mechanisms=[MechanismCardSchema(title="m", explanation="e", bulletPoints=["a", "b"])],
        rabbitHoles=[RabbitHoleTeaserSchema(title="r", teaser="t", affinityCategory="History")],
    )
    assert d.gallery[0].imageUrl == "https://i"
    assert d.mechanisms[0].bulletPoints == ["a", "b"]


def test_precomputed_hub_roundtrip():
    hub = PrecomputedHubSchema(
        id="abc",
        topic="Antikythera",
        category="History",
        root=NodeSchema(id="r", title="T", summary="S"),
        children=[NodeSchema(id="c", title="C", summary="Cs")],
    )
    assert hub.children[0].title == "C"


def test_plan_step_status():
    p = PlanStepSchema(id="step-1", title="t", agent="a")
    assert p.status == "pending"


def test_coordinates_optional_tiles():
    c = Coordinates(lat=1.0, lng=2.0)
    assert c.tileX is None
    assert c.location_name is None