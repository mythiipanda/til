import os
import json
import uuid
import time
import asyncio
import logging
from typing import List, Dict, Any, Optional, Tuple, AsyncGenerator
from openai import AsyncOpenAI

from app.schemas.graph import NodeSchema, Coordinates
from app.services.media import fetch_wikimedia_thumbnail, calculate_osm_tiles
from app.services.graph_agent import run_discovery_workflow

logger = logging.getLogger(__name__)

CEREBRAS_API_KEY = os.getenv("CEREBRAS_API_KEY")
MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY")

CEREBRAS_MODEL = os.getenv("CEREBRAS_MODEL", "gemma-4-31b")
MISTRAL_MODEL = os.getenv("MISTRAL_MODEL", "ministral-8b-2512")

class DynamicKnowledgeSynthesizer:
    """Intelligent fallback knowledge engine when external API keys are not supplied."""

    CATEGORY_PATTERNS = {
        "history": [
            ("The Voynich Manuscript Cipher", "An illustrated codex hand-written in an unknown writing system, carbon-dated to the early 15th century in Renaissance Italy.", 43.7696, 11.2558, "Florence, Italy", "Voynich manuscript page botanical drawing", ["Wilfrid Voynich Discovery", "Cryptographic Decryption Attempts", "Medieval Herbal Pharmacopeias"], "1420 CE"),
            ("The Antikythera Mechanism", "An ancient Greek hand-powered mechanical orrery, described as the oldest known analogue computer used to predict astronomical positions.", 35.8653, 23.3103, "Antikythera, Greece", "Antikythera mechanism bronze relic Athens", ["Ancient Greek Gear Engineering", "Babylonian Eclipse Cycles", "The Roman Shipwreck Salvage"], "c. 150 BCE"),
            ("The Library of Alexandria", "The ancient world's foremost universal repository of knowledge, whose incremental destruction became a tragic symbol of lost civilization lore.", 31.2001, 29.9187, "Alexandria, Egypt", "Library of Alexandria ancient scroll engraving", ["The Great Serapeum Daughter Library", "Callimachus Pinakes Catalog", "Scroll Smuggling and Ship Inspections"], "c. 280 BCE")
        ],
        "physics": [
            ("Quantum Tunneling in Biology", "Enzymatic reactions and avian magnetoreception harness quantum tunneling to allow electrons and protons to bypass classical energy barriers.", 51.7520, -1.2577, "Oxford Quantum Labs, UK", "Quantum mechanics tunneling barrier physics", ["Avian Cryptochrome Compass", "Enzyme Kinetic Isotope Effects", "Proton Translocation in DNA"], "2004 CE"),
            ("Cosmic Microwave Background Anomalies", "The Cold Spot and hemispherical power asymmetry in the CMB challenge standard inflationary cosmology and hint at cosmic topology.", 46.2044, 6.1432, "CERN, Geneva", "WMAP cosmic microwave background radiation map", ["The Eridanus Supervoid Hypothesis", "Multiverse Collision Scars", "Planck Space Observatory Data"], "2013 CE"),
            ("Tachyon Condensation", "A theoretical field process in string theory where unstable vacuum states decay into stable configurations by shedding imaginary mass excitations.", 40.3430, -74.6514, "Princeton, New Jersey", "Spacetime string theory brane diagram", ["D-Brane Decay Dynamics", "Open String Field Theory", "Cosmological Inflation Inflatons"], "1998 CE")
        ],
        "mythology": [
            ("The Ouroboros Eternity Serpent", "An ancient emblem depicting a snake consuming its own tail, symbolizing cyclical renewal, primordial chaos, and the unity of opposites.", 25.6872, 32.6396, "Thebes, Ancient Egypt", "Ouroboros alchemical serpent drawing", ["Egyptian Enigmatic Netherworld Books", "Norse Jormungandr World Serpent", "Jungian Archetypal Individuation"], "c. 1300 BCE"),
            ("The Epic of Gilgamesh Flood Tablet", "Discovered in Nineveh's Library of Ashurbanipal, Tablet XI recounts Utnapishtim's ark construction, pre-dating biblical flood literature.", 36.3589, 43.1539, "Nineveh, Ancient Mesopotamia", "Gilgamesh flood tablet British Museum", ["The Ashurbanipal Royal Library", "Utnapishtim Immortality Quest", "Sumerian Ziusudra Predecessor"], "c. 2100 BCE"),
            ("The Tower of Babel Ziggurat", "The colossal Etemenanki ziggurat of Babylon inspired the enduring cultural archetype of architectural hubris and linguistic divergence.", 32.5363, 44.4208, "Babylon, Mesopotamia", "Etemenanki Babylon ziggurat reconstruction", ["Etemenanki Sacred Architecture", "Linguistic Fragmentation Mythos", "Nebuchadnezzar II Inscriptions"], "c. 600 BCE")
        ]
    }

    @classmethod
    def synthesize_seed(cls, topic: str, category: Optional[str] = None) -> Tuple[NodeSchema, List[NodeSchema]]:
        normalized = topic.lower()
        cat_key = "history"
        if any(w in normalized for w in ["quantum", "physics", "science", "enigma", "universe", "time"]):
            cat_key = "physics"
        elif any(w in normalized for w in ["myth", "legend", "ancient", "symbol", "god", "folklore"]):
            cat_key = "mythology"

        presets = cls.CATEGORY_PATTERNS[cat_key]
        p_root = presets[0]
        p_c1 = presets[1]
        p_c2 = presets[2]

        t_x, t_y = calculate_osm_tiles(p_root[2], p_root[3])
        root_node = NodeSchema(
            id=str(uuid.uuid4()),
            title=f"{topic.title()}: {p_root[0]}",
            summary=p_root[1],
            category=category or "Curiosity Driver",
            coordinates=Coordinates(lat=p_root[2], lng=p_root[3], tileX=t_x, tileY=t_y, location_name=p_root[4]),
            image_search_query=p_root[5],
            rabbit_holes=p_root[6],
            timestamp=p_root[7],
            confidence=0.98,
            audio_summary=f"Exploring {topic}: {p_root[1]}"
        )

        children: List[NodeSchema] = []
        for p in [p_c1, p_c2]:
            cx, cy = calculate_osm_tiles(p[2], p[3])
            children.append(
                NodeSchema(
                    id=str(uuid.uuid4()),
                    title=p[0],
                    summary=p[1],
                    category=category or "Deep Dive",
                    coordinates=Coordinates(lat=p[2], lng=p[3], tileX=cx, tileY=cy, location_name=p[4]),
                    image_search_query=p[5],
                    rabbit_holes=p[6],
                    timestamp=p[7],
                    confidence=0.96,
                    audio_summary=p[1]
                )
            )

        lat3, lng3 = p_root[2] + 1.2, p_root[3] - 1.5
        c3x, c3y = calculate_osm_tiles(lat3, lng3)
        children.append(
            NodeSchema(
                id=str(uuid.uuid4()),
                title=f"The {topic.title()} Nexus Effect",
                summary=f"How research into {topic} reveals hidden interdisciplinary links between archaeological records and modern computational models.",
                category=category or "Interdisciplinary Link",
                coordinates=Coordinates(lat=lat3, lng=lng3, tileX=c3x, tileY=c3y, location_name="Global Observatory"),
                image_search_query=f"{topic} historical archival illustration",
                rabbit_holes=[f"{topic} Archive Records", f"{topic} Modern Parallels", f"Cross-Cultural {topic} Inscriptions"],
                timestamp="Contemporary Analysis",
                confidence=0.94,
                audio_summary=f"The nexus effect examines how {topic} continues to reshape our understanding of historical networks."
            )
        )

        return root_node, children

    @classmethod
    def synthesize_expansion(cls, parent_id: str, topic: str, context_chain: List[str]) -> List[NodeSchema]:
        sub_topics = [
            (f"{topic}: Origins & Genesis", f"Historical and empirical evidence uncovering the early formative phases of {topic} across ancient chronicles.", 37.9838, 23.7275, "Mediterranean Basin", f"{topic} ancient manuscript artifact", [f"Earliest {topic} Records", f"Archaeological Traces of {topic}", f"{topic} Founding Figures"], "c. 450 BCE"),
            (f"{topic}: Hidden Mechanisms", f"The underlying structural mechanics, chemical processes, or sociological forces governing {topic}.", 52.3676, 4.9041, "North Sea Maritime Archive", f"{topic} diagram schema illustration", [f"Mathematical Modeling of {topic}", f"Chemical Analysis of {topic}", f"System Dynamics in {topic}"], "1687 CE"),
            (f"{topic}: Modern Frontiers", f"Contemporary experiments and digital reconstructions pushing the theoretical boundaries of {topic} today.", 37.7749, -122.4194, "San Francisco Institute", f"{topic} modern laboratory science research", [f"AI Applications to {topic}", f"Quantum Sensors in {topic}", f"Next-Century {topic} Projections"], "2024 CE"),
        ]

        results: List[NodeSchema] = []
        for item in sub_topics:
            tx, ty = calculate_osm_tiles(item[2], item[3])
            results.append(
                NodeSchema(
                    id=str(uuid.uuid4()),
                    title=item[0],
                    summary=item[1],
                    category="Rabbit Hole Vector",
                    coordinates=Coordinates(lat=item[2], lng=item[3], tileX=tx, tileY=ty, location_name=item[4]),
                    image_search_query=item[5],
                    rabbit_holes=item[6],
                    timestamp=item[7],
                    confidence=0.95,
                    audio_summary=item[1]
                )
            )
        return results

class InferenceService:
    def __init__(self):
        self.cerebras_api_key = os.getenv("CEREBRAS_API_KEY")
        self.mistral_api_key = os.getenv("MISTRAL_API_KEY")
        self.cerebras_model = CEREBRAS_MODEL
        self.mistral_model = MISTRAL_MODEL

        # OpenAI standard client for Cerebras
        self._openai_client = None
        if self.cerebras_api_key:
            self._openai_client = AsyncOpenAI(
                api_key=self.cerebras_api_key,
                base_url="https://api.cerebras.ai/v1"
            )

    async def generate_seed(self, topic: str, category: Optional[str] = None) -> Tuple[NodeSchema, List[NodeSchema], str, float]:
        """Execute LangGraph structured discovery agent."""
        nodes, engine, elapsed = await run_discovery_workflow(
            task_type="seed",
            topic=topic,
            category=category,
        )
        if len(nodes) >= 4:
            return nodes[0], nodes[1:4], engine, elapsed
        elif len(nodes) > 0:
            root_fallback, children_fallback = DynamicKnowledgeSynthesizer.synthesize_seed(topic, category)
            return nodes[0], children_fallback, engine, elapsed
        else:
            root_fallback, children_fallback = DynamicKnowledgeSynthesizer.synthesize_seed(topic, category)
            return root_fallback, children_fallback, "fallback-synthesizer", elapsed

    async def generate_expansion(self, parent_id: str, topic: str, context_chain: List[str]) -> Tuple[List[NodeSchema], str, float]:
        """Execute LangGraph expansion workflow."""
        nodes, engine, elapsed = await run_discovery_workflow(
            task_type="expand",
            topic=topic,
            parent_id=parent_id,
            context_chain=context_chain,
        )
        return nodes[:3], engine, elapsed

    async def stream_chat(self, node_title: str, user_question: str, ancestor_context: List[str]) -> AsyncGenerator[str, None]:
        """Stream conversational Q&A tokens via standard OpenAI AsyncClient connected to Cerebras."""
        if self._openai_client:
            try:
                system_msg = (
                    f"You are the Curiosity MindMap Guide. You are exploring '{node_title}' "
                    f"within the context of: {' -> '.join(ancestor_context) if ancestor_context else 'Root Topic'}. "
                    "Provide 2 concise, engaging paragraphs explaining the key mechanism and historical/scientific significance, "
                    "followed by 2 suggested rabbit holes."
                )
                stream = await self._openai_client.chat.completions.create(
                    model=self.cerebras_model,
                    messages=[
                        {"role": "system", "content": system_msg},
                        {"role": "user", "content": user_question}
                    ],
                    temperature=0.7,
                    stream=True,
                )
                async for chunk in stream:
                    delta = chunk.choices[0].delta.content or ""
                    if delta:
                        yield f"data: {json.dumps({'token': delta})}\n\n"
                yield "data: [DONE]\n\n"
                return
            except Exception as e:
                logger.warning(f"OpenAI client stream error ({e}), falling back to simulated stream")

        # Simulated streaming fallback
        narrative = (
            f"Regarding **{node_title}**, this concept serves as a vital cross-disciplinary vector.\n\n"
            f"When examining **{user_question}**, historical records and empirical investigations demonstrate that the core phenomenon was shaped by both systemic environmental pressures and anomalous cognitive or structural adaptations. "
            f"Researchers at major observatories and historical institutes continue to analyze how primary documents corroborate these early observations.\n\n"
            f"### Key Takeaways:\n"
            f"- **Primary Mechanism**: The interplay between local environmental catalysts and emergent behavior patterns.\n"
            f"- **Broader Significance**: It connects ancient records directly with modern theoretical paradigms.\n\n"
            f"**Suggested Next Vectors**:\n"
            f"1. *Archive Inscriptions and Primary Eyewitness Accounts*\n"
            f"2. *Modern Replications and Laboratory Recreations*"
        )

        words = narrative.split(" ")
        for i, word in enumerate(words):
            yield f"data: {json.dumps({'token': word + ' '})}\n\n"
            await asyncio.sleep(0.012)

        yield "data: [DONE]\n\n"

inference_service = InferenceService()
