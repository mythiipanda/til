import math


def calculate_osm_tiles(lat: float, lng: float, zoom: int = 12) -> tuple[int, int]:
    """Convert WGS84 coordinates into OpenStreetMap tile X/Y coordinates."""
    # Clamp lat/lng
    lat = max(-85.05112878, min(85.05112878, lat))
    lng = max(-180.0, min(180.0, lng))

    lat_rad = math.radians(lat)
    n = 2.0**zoom
    tile_x = int((lng + 180.0) / 360.0 * n)
    tile_y = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return tile_x, tile_y
