"""media.py tile math tests."""

from app.services.media import calculate_osm_tiles


def test_known_coordinate():
    # London at zoom 12
    tx, ty = calculate_osm_tiles(51.5074, -0.1278, zoom=12)
    assert tx == 2046
    assert ty == 1362


def test_clamps_latitude():
    # Out-of-range lat gets clamped to ±85.05112878, no crash
    tx, ty = calculate_osm_tiles(91.0, 0.0, zoom=1)
    assert 0 <= tx < 2 and 0 <= ty < 2


def test_clamps_longitude():
    tx, ty = calculate_osm_tiles(0.0, 190.0, zoom=2)
    assert 0 <= tx <= 4 and 0 <= ty <= 4


def test_zoom_zero():
    tx, ty = calculate_osm_tiles(0.0, 0.0, zoom=0)
    assert (tx, ty) == (0, 0)


def test_origin():
    tx, ty = calculate_osm_tiles(0.0, 0.0, zoom=2)
    # lat 0 -> half of the 2^zoom grid vertically
    assert ty == 2
    assert tx == 2