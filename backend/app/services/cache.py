import os
import json
import logging
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)

# Precomputed rich hub cache dataset for instant 0ms responses
PRECOMPUTED_HUBS: Dict[str, Dict[str, Any]] = {
    "obscure history": {
        "root": {
            "id": "hub-history-root",
            "title": "The Dancing Plague of 1518",
            "summary": "In July 1518, hundreds of residents of Strasbourg danced uncontrollably for days without rest in a mass psychogenic phenomenon.",
            "category": "Obscure History",
            "coordinates": {"lat": 48.5734, "lng": 7.7521, "tileX": 2134, "tileY": 1412, "location_name": "Strasbourg, France"},
            "image_search_query": "Danse macabre Strasbourg medieval engraving",
            "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Pieter_Brueghel_the_Elder_-_The_Triumph_of_Death_-_Google_Art_Project.jpg/800px-Pieter_Brueghel_the_Elder_-_The_Triumph_of_Death_-_Google_Art_Project.jpg",
            "rabbit_holes": ["Ergot Fungal Poisoning", "Mass Sociogenic Illness Cases", "St. Vitus Holy Dance Shrines"],
            "timestamp": "1518 CE",
            "confidence": 0.98,
            "audio_summary": "In the sweltering July of 1518, Frau Troffea stepped into a narrow Strasbourg street and began dancing. Within a month, hundreds joined in an inescapable trance."
        },
        "children": [
            {
                "id": "hub-history-c1",
                "title": "Ergot Fungal Poisoning",
                "summary": "Claviceps purpurea grows on rye and contains alkaloids chemically related to LSD, historically inducing spasms, hallucinations, and intense burning sensations known as Saint Anthony's Fire.",
                "category": "Obscure History",
                "coordinates": {"lat": 47.9959, "lng": 7.8522, "tileX": 2136, "tileY": 1420, "location_name": "Black Forest, Germany"},
                "image_search_query": "Claviceps purpurea rye ergot fungus",
                "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Claviceps_purpurea_01.jpg/800px-Claviceps_purpurea_01.jpg",
                "rabbit_holes": ["Salem Witch Trial Mycotoxins", "Albert Hofmann Ergoline Synthesis", "Medieval Bread Regulation Laws"],
                "timestamp": "1095 CE",
                "confidence": 0.96,
                "audio_summary": "Ergotism, caused by moldy rye grain, plagued European villages with delirium and gangrene long before modern organic chemistry isolated its active alkaloids."
            },
            {
                "id": "hub-history-c2",
                "title": "Mass Sociogenic Illness Cases",
                "summary": "Throughout history, extreme social stress, famine, and psychological pressures have triggered shared somatic symptoms ranging from the 1962 Tanganyika Laughter Epidemic to medieval choreomania.",
                "category": "Obscure History",
                "coordinates": {"lat": -1.3314, "lng": 31.8122, "tileX": 2410, "tileY": 2060, "location_name": "Kashasha, Tanzania"},
                "image_search_query": "Psychology history crowd hysteria collective behavior",
                "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Charcot_at_the_Salp%C3%AAtri%C3%A8re.jpg/800px-Charcot_at_the_Salp%C3%AAtri%C3%A8re.jpg",
                "rabbit_holes": ["The Tanganyika Laughter Outbreak", "Morzine Spirit Possession Wave", "Collective Neurosis in Enclosed Communities"],
                "timestamp": "1962 CE",
                "confidence": 0.95,
                "audio_summary": "Psychogenic contagion demonstrates how human nervous systems mirror distress in tight-knit groups, producing physical symptoms without any biological pathogen."
            },
            {
                "id": "hub-history-c3",
                "title": "St. Vitus Holy Dance Shrines",
                "summary": "Medieval European clergy directed affected dancers to the mountaintop shrine of St. Vitus in Saverne, where red-shoed victims were given small crosses and holy oil.",
                "category": "Obscure History",
                "coordinates": {"lat": 48.7417, "lng": 7.3622, "tileX": 2130, "tileY": 1408, "location_name": "Saverne, Vosges Mountains"},
                "image_search_query": "Saint Vitus cathedral medieval relic altar",
                "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/St._Vitus_Cathedral_Prague_2016_1.jpg/800px-St._Vitus_Cathedral_Prague_2016_1.jpg",
                "rabbit_holes": ["Saverne Mountain Sanctuaries", "Tarantism in Southern Italy", "Red Shoe Ritual Traditions"],
                "timestamp": "1518 CE",
                "confidence": 0.97,
                "audio_summary": "Saverne became the sanctuary of last resort for the Strasbourg dancers, where sacred ceremonies and soothing music were employed to quiet the fevered crowds."
            }
        ]
    },
    "quantum paradoxes": {
        "root": {
            "id": "hub-quantum-root",
            "title": "Quantum Delayed-Choice Eraser",
            "summary": "An optical experiment demonstrating that observing which-way photon path information in the present seemingly alters whether interference occurred in the past.",
            "category": "Quantum Paradoxes",
            "coordinates": {"lat": 38.9897, "lng": -76.9378, "tileX": 1172, "tileY": 1566, "location_name": "University of Maryland, USA"},
            "image_search_query": "Quantum optics laser beam splitter lab interferometer",
            "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Interferometer.svg/800px-Interferometer.svg.png",
            "rabbit_holes": ["Wheeler Delayed Choice Thought Experiment", "Quantum Entanglement Non-Locality", "Retrocausality Interpretations"],
            "timestamp": "1999 CE",
            "confidence": 0.99,
            "audio_summary": "The delayed-choice quantum eraser pushes quantum mechanics to its most bewildering limits, showing that whether photons behave as waves or particles can be determined after they have already passed through the slit apparatus."
        },
        "children": [
            {
                "id": "hub-quantum-c1",
                "title": "Wheeler Delayed Choice Thought Experiment",
                "summary": "Proposed by John Archibald Wheeler in 1978, this experiment uses cosmic gravitational lenses from distant quasars to test quantum wave-particle duality across billions of light years.",
                "category": "Quantum Paradoxes",
                "coordinates": {"lat": 40.3430, "lng": -74.6514, "tileX": 1205, "tileY": 1538, "location_name": "Princeton Institute, USA"},
                "image_search_query": "Gravitational lens quasar hubble space telescope",
                "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/Hubble_views_a_bizarre_cosmic_mirage.jpg/800px-Hubble_views_a_bizarre_cosmic_mirage.jpg",
                "rabbit_holes": ["Cosmic Scale Interferometry", "Wavefunction Collapse Models", "Observer Effect Epistemology"],
                "timestamp": "1978 CE",
                "confidence": 0.97,
                "audio_summary": "Wheeler asked: if a photon traveled through a gravitational lens billions of years ago, can our telescope measurement today decide which cosmic path it took in deep prehistory?"
            },
            {
                "id": "hub-quantum-c2",
                "title": "Quantum Entanglement Non-Locality",
                "summary": "Spooky action at a distance connects twin entangled photons across arbitrary spacetime intervals, violating local realism as confirmed by Nobel-winning Bell inequality tests.",
                "category": "Quantum Paradoxes",
                "coordinates": {"lat": 48.2082, "lng": 16.3738, "tileX": 2235, "tileY": 1428, "location_name": "Vienna Quantum Center, Austria"},
                "image_search_query": "Quantum entanglement laser laboratory physics",
                "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Quantum_teleportation_diagram.svg/800px-Quantum_teleportation_diagram.svg.png",
                "rabbit_holes": ["Clauser-Aspect-Zeilinger Experiments", "EPR Paradox Einstein Bohr Debate", "Quantum Cryptography QKD Networks"],
                "timestamp": "1964 CE",
                "confidence": 0.98,
                "audio_summary": "Entangled particles behave not as separate physical entities exchanging signals, but as single unified states distributed across space."
            },
            {
                "id": "hub-quantum-c3",
                "title": "Retrocausality Interpretations",
                "summary": "Theoretical frameworks like the Transactional Interpretation propose advanced and retarded waves propagating backward and forward in time to resolve quantum measurement puzzles.",
                "category": "Quantum Paradoxes",
                "coordinates": {"lat": 47.6553, "lng": -122.3035, "tileX": 655, "tileY": 1412, "location_name": "University of Washington, Seattle"},
                "image_search_query": "Minkowski spacetime light cone diagram physics",
                "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/16/World_line.svg/800px-World_line.svg.png",
                "rabbit_holes": ["Transactional Interpretation of QM", "Wheeler-Feynman Absorber Theory", "Causal Loops in Microphysics"],
                "timestamp": "1986 CE",
                "confidence": 0.94,
                "audio_summary": "Retrocausality suggests nature maintains symmetry by allowing microscopic boundary conditions to influence quantum handshakes from the future to the past."
            }
        ]
    },
    "comparative mythology": {
        "root": {
            "id": "hub-myth-root",
            "title": "The World Tree Axis Mundi",
            "summary": "A ubiquitous mythological motif connecting the underworld, terrestrial realm, and heavens found across Norse, Mesoamerican, Siberian, and Vedic traditions.",
            "category": "Comparative Mythology",
            "coordinates": {"lat": 63.8258, "lng": 20.2630, "tileX": 2260, "tileY": 1050, "location_name": "Scandinavia"},
            "image_search_query": "Yggdrasil world tree manuscript norse mythology",
            "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Yggdrasil.jpg/800px-Yggdrasil.jpg",
            "rabbit_holes": ["Yggdrasil Cosmic Ash Tree", "Mayan Ceiba Tree of Life", "Shamanic Pole Ascensions"],
            "timestamp": "c. 800 BCE",
            "confidence": 0.98,
            "audio_summary": "From the Norse Yggdrasil to the Mayan Wacah Chan, ancient civilizations independently conceptualized the cosmos as a colossal living tree whose roots anchor existence."
        },
        "children": [
            {
                "id": "hub-myth-c1",
                "title": "Yggdrasil Cosmic Ash Tree",
                "summary": "In Norse cosmology, the great evergreen ash tree Yggdrasil shelters the Nine Realms, its roots gnawed by the dragon Nidhogg while an eagle sits atop its high branches.",
                "category": "Comparative Mythology",
                "coordinates": {"lat": 59.9139, "lng": 10.7522, "tileX": 2185, "tileY": 1162, "location_name": "Oslo Viking Lands, Norway"},
                "image_search_query": "Viking wood carving rune stone norse",
                "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Norse_tree_Yggdrasil.jpg/800px-Norse_tree_Yggdrasil.jpg",
                "rabbit_holes": ["The Norns at Urdarbrunnr", "Ratatoskr Squirrel Messenger", "Ragnarok Renewal Cycle"],
                "timestamp": "c. 900 CE",
                "confidence": 0.97,
                "audio_summary": "Yggdrasil represents endurance through catastrophe; even as Ragnarok consumes the world, two human survivors find shelter in its resilient trunk to repopulate humanity."
            },
            {
                "id": "hub-myth-c2",
                "title": "Mayan Ceiba Tree of Life",
                "summary": "The sacred Yaaxche (Ceiba pentandra) stood at the center of the Mayan universe, its branches puncturing the thirteen layers of heaven and roots descending into Xibalba.",
                "category": "Comparative Mythology",
                "coordinates": {"lat": 17.2220, "lng": -89.6237, "tileX": 1028, "tileY": 1890, "location_name": "Tikal, Guatemala"},
                "image_search_query": "Tikal Mayan pyramid temple ceiba forest",
                "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Tikal_Temple1.jpg/800px-Tikal_Temple1.jpg",
                "rabbit_holes": ["Xibalba Mayan Underworld Lords", "Popol Vuh Creation Narrative", "Four Directional World Wardens"],
                "timestamp": "c. 250 CE",
                "confidence": 0.96,
                "audio_summary": "For Maya astronomers and priests, the Ceiba tree served as the cosmological highway through which royal ancestors and deities journeyed between planes of reality."
            },
            {
                "id": "hub-myth-c3",
                "title": "Shamanic Pole Ascensions",
                "summary": "Indigenous Siberian Evenki and Altaic shamans erect notched birch poles representing the axis mundi to psychically climb into celestial realms during healing rituals.",
                "category": "Comparative Mythology",
                "coordinates": {"lat": 53.5587, "lng": 108.1650, "tileX": 3280, "tileY": 1330, "location_name": "Lake Baikal, Siberia"},
                "image_search_query": "Siberian shaman totem pole Lake Baikal ritual",
                "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Shamanka_rock_Olkhon.jpg/800px-Shamanka_rock_Olkhon.jpg",
                "rabbit_holes": ["Mircea Eliade Archaic Shamanism", "Tungusic Sky God Tengri", "World Pillar Symbolism in Eurasia"],
                "timestamp": "c. 1500 BCE",
                "confidence": 0.95,
                "audio_summary": "By climbing the central pole, the shaman symbolically transverses the axis of the cosmos, returning with songs, cures, and cosmological prophecies."
            }
        ]
    }
}

class CacheService:
    def __init__(self):
        self._memory_cache: Dict[str, Dict[str, Any]] = {}
        self._redis_client = None
        self._init_redis()

    def _init_redis(self):
        redis_url = os.getenv("REDIS_URL")
        if redis_url:
            try:
                import redis
                self._redis_client = redis.from_url(redis_url, decode_responses=True)
                logger.info("Connected to Redis cache")
            except Exception as e:
                logger.warning(f"Failed to connect to Redis ({e}), using in-memory LRU fallback")
                self._redis_client = None

    def get(self, key: str) -> Optional[Dict[str, Any]]:
        # 1. Check Redis
        if self._redis_client:
            try:
                val = self._redis_client.get(key)
                if val:
                    return json.loads(val)
            except Exception as e:
                logger.error(f"Redis get error: {e}")

        # 2. Check Memory Cache
        if key in self._memory_cache:
            return self._memory_cache[key]

        # 3. Check Precomputed Hubs by category or key phrase
        normalized_key = key.lower().strip()
        for hub_category, data in PRECOMPUTED_HUBS.items():
            root_title = data["root"]["title"].lower()
            if hub_category in normalized_key or root_title in normalized_key or any(w in normalized_key for w in ["dancing plague", "1518", "eraser", "delayed-choice", "axis mundi", "world tree"]):
                if "dancing plague" in normalized_key or "1518" in normalized_key or "history" in normalized_key:
                    return PRECOMPUTED_HUBS["obscure history"]
                elif "quantum" in normalized_key or "eraser" in normalized_key or "physics" in normalized_key:
                    return PRECOMPUTED_HUBS["quantum paradoxes"]
                elif "myth" in normalized_key or "tree" in normalized_key or "axis mundi" in normalized_key:
                    return PRECOMPUTED_HUBS["comparative mythology"]
                return data

        return None

    def set(self, key: str, value: Dict[str, Any], ttl_seconds: int = 86400):
        # 1. Set Memory
        self._memory_cache[key] = value

        # 2. Set Redis
        if self._redis_client:
            try:
                self._redis_client.setex(key, ttl_seconds, json.dumps(value))
            except Exception as e:
                logger.error(f"Redis set error: {e}")

    @staticmethod
    def get_seed_key(topic: str) -> str:
        return f"seed:{topic.lower().strip()}"

    @staticmethod
    def get_expansion_key(parent_id: str, topic: str) -> str:
        return f"expand:{parent_id}:{topic.lower().strip()}"

cache_service = CacheService()
