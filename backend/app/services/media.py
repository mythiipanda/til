import math
import httpx
import logging
from typing import Optional, Tuple, Dict, Any

logger = logging.getLogger(__name__)

WIKIMEDIA_ENDPOINT = "https://commons.wikimedia.org/w/api.php"
CUSTOM_USER_AGENT = "InfiniteCuriosityEngine/1.0 (https://curiosity.platform; contact@curiosity.platform)"

def calculate_osm_tiles(lat: float, lng: float, zoom: int = 12) -> Tuple[int, int]:
    """Convert WGS84 coordinates into OpenStreetMap tile X/Y coordinates."""
    # Clamp lat/lng
    lat = max(-85.05112878, min(85.05112878, lat))
    lng = max(-180.0, min(180.0, lng))

    lat_rad = math.radians(lat)
    n = 2.0 ** zoom
    tile_x = int((lng + 180.0) / 360.0 * n)
    tile_y = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return tile_x, tile_y

async def fetch_wikimedia_thumbnail(query: str, proxy_base_url: str = "") -> Optional[str]:
    """
    Search Wikimedia Commons for high-quality thumbnail image.
    Applies custom User-Agent and routes URL through edge proxy.
    """
    if not query or len(query.strip()) < 2:
        return None

    params = {
        "action": "query",
        "format": "json",
        "generator": "search",
        "gsrnamespace": "6", # File namespace
        "gsrlimit": "3",
        "prop": "imageinfo",
        "iiprop": "url|mime",
        "iiurlwidth": "800",
        "gsrsearch": query,
    }
    headers = {
        "User-Agent": CUSTOM_USER_AGENT,
        "Accept-Encoding": "gzip",
    }

    try:
        async with httpx.AsyncClient(timeout=3.5) as client:
            response = await client.get(WIKIMEDIA_ENDPOINT, params=params, headers=headers)
            if response.status_code != 200:
                return None

            data = response.json()
            pages = data.get("query", {}).get("pages", {})
            for page_id, page_data in pages.items():
                image_info_list = page_data.get("imageinfo", [])
                if image_info_list:
                    image_info = image_info_list[0]
                    raw_url = image_info.get("thumburl") or image_info.get("url")
                    if raw_url:
                        if proxy_base_url:
                            # Route through Cloudflare or Next.js edge proxy
                            return f"{proxy_base_url}/api/media?url={httpx.URL(raw_url)}"
                        return raw_url
    except Exception as e:
        logger.warning(f"Wikimedia API fetch error for query '{query}': {e}")
        return None

    return None
