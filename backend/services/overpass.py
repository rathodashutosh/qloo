"""Overpass API client for querying OpenStreetMap venues."""

import httpx
import math
import logging
from typing import Optional

from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

OVERPASS_SERVERS = [
    settings.OVERPASS_URL,
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
]


def _bounding_box(lat: float, lon: float, radius_km: float) -> tuple[float, float, float, float]:
    """Compute a bounding box (south, west, north, east) around a point."""
    d_lat = radius_km / 111.0
    d_lon = radius_km / (111.0 * math.cos(math.radians(lat)))
    return (round(lat - d_lat, 5), round(lon - d_lon, 5), round(lat + d_lat, 5), round(lon + d_lon, 5))


def build_overpass_query(osm_filter: str, lat: float, lon: float, radius_km: float) -> str:
    """
    Build an Overpass QL query from a concept's osm_filter string.
    """
    south, west, north, east = _bounding_box(lat, lon, radius_km)
    bbox = f"{south},{west},{north},{east}"

    clauses = [c.strip() for c in osm_filter.split(" or ")]
    union_parts = []
    for clause in clauses:
        union_parts.append(f"  node{clause}({bbox});")
        union_parts.append(f"  way{clause}({bbox});")

    query = "[out:json][timeout:25];\n(\n" + "\n".join(union_parts) + "\n);\nout center 40;"
    return query


async def query_overpass(
    osm_filter: str,
    lat: float,
    lon: float,
    radius_km: float = 1.5,
) -> list[dict]:
    """
    Query the Overpass API with custom User-Agent and return parsed venues.
    """
    query = build_overpass_query(osm_filter, lat, lon, radius_km)
    headers = {
        "User-Agent": "TasteGapFinder/1.0 (Hackathon Location Analytics; contact@tastegap.app)",
        "Accept": "application/json",
    }

    last_error = None
    for server_url in OVERPASS_SERVERS:
        try:
            async with httpx.AsyncClient(timeout=3.5, headers=headers) as client:
                resp = await client.post(server_url, data={"data": query})
                if resp.status_code == 200:
                    data = resp.json()
                    elements = data.get("elements", [])
                    venues: list[dict] = []
                    for el in elements:
                        tags = el.get("tags", {})
                        name = tags.get("name")
                        if el.get("type") == "way":
                            center = el.get("center", {})
                            v_lat = center.get("lat", lat)
                            v_lon = center.get("lon", lon)
                        else:
                            v_lat = el.get("lat", lat)
                            v_lon = el.get("lon", lon)

                        venues.append({
                            "osm_id": f"{el.get('type', 'node')}/{el.get('id', '')}",
                            "name": name,
                            "lat": v_lat,
                            "lon": v_lon,
                            "tags": tags,
                        })
                    logger.info("Overpass [%s] returned %d venues", server_url, len(venues))
                    return venues
        except Exception as exc:
            last_error = exc
            logger.debug("Overpass [%s] request failed: %s", server_url, exc)

    logger.warning("All Overpass servers failed or timed out: %s", last_error)
    return []
