"""
Batch Precomputation Script using Mistral API
Leverages Mistral high throughput / rate limits (1.3M TPM, 12.5 RPS)
to precompute multi-depth category hubs into Redis / JSON catalog.
"""

import os
import json
import asyncio
import httpx
import logging
from dotenv import load_dotenv

load_dotenv()

MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY")
MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions"

DEFAULT_CATEGORIES = [
    "Obscure History",
    "Quantum Paradoxes",
    "Comparative Mythology",
    "Deep-Sea Enigmas",
    "Lost Civilizations",
    "Renaissance Inventions",
    "Consciousness & Cognitive Frontiers"
]

SYSTEM_PROMPT = """You are the Knowledge Graph Synthesizer for the Infinite Curiosity Engine.
Given a topic, generate a 2-depth hierarchical mindmap tree.
Return valid JSON with 'root' (1 node) and 'children' (3 child nodes, each with 3 rabbit_holes).
Each node must include:
- id: string
- title: string
- summary: string (concise 2 sentences)
- category: string
- coordinates: {"lat": float, "lng": float, "location_name": string}
- image_search_query: string
- rabbit_holes: list of 3 strings
- timestamp: string
- audio_summary: string
"""

async def precompute_category(category: str, client: httpx.AsyncClient):
    print(f"[*] Precomputing hub: {category}...")
    if not MISTRAL_API_KEY:
        print(f"[!] MISTRAL_API_KEY not configured. Skipping live batch API call for {category}.")
        return None

    headers = {
        "Authorization": f"Bearer {MISTRAL_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": "ministral-8b-2512", # or ministral-3b-2512 for 12.5 RPS
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Generate deep structured mindmap tree for category: '{category}'"}
        ],
        "temperature": 0.7,
        "response_format": {"type": "json_object"}
    }

    try:
        response = await client.post(MISTRAL_API_URL, headers=headers, json=payload, timeout=30.0)
        if response.status_code == 200:
            result = response.json()
            content = result["choices"][0]["message"]["content"]
            parsed = json.loads(content)
            print(f"[+] Successfully precomputed {category} ({len(parsed.get('children', []))} children)")
            return parsed
        else:
            print(f"[-] Failed {category}: HTTP {response.status_code} - {response.text}")
    except Exception as e:
        print(f"[-] Error precomputing {category}: {e}")
    return None

async def main():
    print(f"=== Starting Mistral Precomputation Pipeline for {len(DEFAULT_CATEGORIES)} Categories ===")
    async with httpx.AsyncClient() as client:
        tasks = [precompute_category(cat, client) for cat in DEFAULT_CATEGORIES]
        results = await asyncio.gather(*tasks)

    # Save to catalog file
    output_path = os.path.join(os.path.dirname(__file__), "..", "data", "precomputed_catalog.json")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    catalog = {cat: res for cat, res in zip(DEFAULT_CATEGORIES, results) if res}
    if catalog:
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(catalog, f, indent=2)
        print(f"[+] Saved {len(catalog)} precomputed hubs to {output_path}")
    else:
        print("[!] No live data returned. Built-in precomputed static hubs remain active.")

if __name__ == "__main__":
    asyncio.run(main())
