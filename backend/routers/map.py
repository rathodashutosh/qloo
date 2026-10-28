"""Map router — returns GeoJSON for the map view."""

import json
import logging
from typing import Optional

from fastapi import APIRouter, Query
from db import database
from models import GeoJSONFeature, GeoJSONFeatureCollection, GeoJSONFeatureProperties
from services.grid import get_hexagon_polygon

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/map")
async def get_map(
    city: str = Query(..., description="City name"),
    concept: Optional[str] = Query(None, description="Concept ID"),
    concept_id: Optional[str] = Query(None, description="Concept ID alias"),
) -> GeoJSONFeatureCollection:
    """
    Return a GeoJSON FeatureCollection of scored cells for a city × concept.
    Each feature is a hex cell polygon with demand/supply/gap properties.
    """
    active_concept = concept or concept_id or "specialty-coffee"

    # Normalize city search
    query = """
        SELECT c.id as cell_id, c.lat, c.lon, c.radius_km, c.label, c.h3_index,
               s.demand, s.supply, s.gap, s.confidence
        FROM cells c
        LEFT JOIN scores s ON c.id = s.cell_id AND s.concept_id = :concept_id
        WHERE LOWER(c.city) LIKE LOWER(:city_pattern)
    """
    city_pattern = f"%{city.strip()}%"
    rows = await database.fetch_all(
        query, values={"city_pattern": city_pattern, "concept_id": active_concept}
    )

    # Fallback to all cells if specific city not found
    if not rows:
        query_all = """
            SELECT c.id as cell_id, c.lat, c.lon, c.radius_km, c.label, c.h3_index,
                   s.demand, s.supply, s.gap, s.confidence
            FROM cells c
            LEFT JOIN scores s ON c.id = s.cell_id AND s.concept_id = :concept_id
        """
        rows = await database.fetch_all(query_all, values={"concept_id": active_concept})

    features = []
    for row in rows:
        lat = row["lat"]
        lon = row["lon"]
        radius_km = row["radius_km"] or 1.2
        h3_idx = row["h3_index"]

        # Calculate exact hexagon polygon
        polygon_coords = get_hexagon_polygon(lat, lon, radius_km, h3_idx)

        # Ensure properties have both id and cell_id for client convenience
        properties = {
            "id": row["cell_id"],
            "cell_id": row["cell_id"],
            "lat": lat,
            "lon": lon,
            "demand": row["demand"] if row["demand"] is not None else 0.5,
            "supply": row["supply"] if row["supply"] is not None else 0.5,
            "gap": row["gap"] if row["gap"] is not None else 0.25,
            "confidence": row["confidence"] or "medium",
            "label": row["label"] or row["cell_id"],
        }

        feature = {
            "type": "Feature",
            "id": row["cell_id"],
            "geometry": {
                "type": "Polygon",
                "coordinates": [polygon_coords],
            },
            "properties": properties,
        }
        features.append(feature)

    logger.info("Map: returning %d features for city=%s concept=%s", len(features), city, active_concept)
    return {"type": "FeatureCollection", "features": features}
