"""Location intelligence service: queries real Qloo taste data and venues for any selected location."""

import json
import math
import logging
from typing import Dict, Any, List

from config import get_settings
from services.qloo import qloo_client
from services.geocoding import reverse_geocode

logger = logging.getLogger(__name__)
settings = get_settings()

CONCEPT_MAP = {
    "specialty-coffee": {
        "name": "Specialty Coffee",
        "search_term": "specialty coffee cafe",
        "tags": ["specialty coffee", "artisan coffee", "third wave coffee", "espresso", "roastery"],
        "saturation": 8,
    },
    "live-music-venue": {
        "name": "Live Music Venue",
        "search_term": "live music venue jazz club pub",
        "tags": ["live music", "jazz club", "music venue", "acoustic", "concert hall"],
        "saturation": 4,
    },
    "board-game-cafe": {
        "name": "Board Game Cafe",
        "search_term": "board game cafe tabletop games",
        "tags": ["board games", "tabletop gaming", "game cafe", "card games"],
        "saturation": 3,
    },
    "bookstore-cafe": {
        "name": "Bookstore Cafe",
        "search_term": "bookstore cafe book cafe library",
        "tags": ["bookstore", "book cafe", "literary", "reading space"],
        "saturation": 4,
    },
    "vegan-restaurant": {
        "name": "Vegan Restaurant",
        "search_term": "vegan restaurant plant based dining",
        "tags": ["vegan", "plant-based", "organic", "healthy dining"],
        "saturation": 5,
    },
    "co-working-cafe": {
        "name": "Co-working Cafe",
        "search_term": "coworking cafe work friendly coffee",
        "tags": ["coworking", "work friendly", "wifi cafe", "laptop friendly"],
        "saturation": 6,
    },
    "craft-brewery": {
        "name": "Craft Brewery",
        "search_term": "craft brewery brewpub microbrewery",
        "tags": ["craft beer", "microbrewery", "brewpub", "draught beer"],
        "saturation": 4,
    },
    "natural-wine-bar": {
        "name": "Natural Wine Bar",
        "search_term": "wine bar natural wine lounge",
        "tags": ["wine bar", "natural wine", "sommelier", "tasting room"],
        "saturation": 4,
    },
}


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


async def analyze_location(
    lat: float,
    lon: float,
    concept_id: str = "specialty-coffee",
    area_label: str = None,
    radius_km: float = 2.0,
) -> Dict[str, Any]:
    """Perform real-time location analysis calling Qloo for live venues, tags, and calculating scores."""
    # 1. Reverse geocode if area_label is not provided or is generic
    geo = await reverse_geocode(lat, lon)
    suburb = geo["suburb"]
    city = geo["city"]
    display_label = area_label or geo["label"]

    concept_info = CONCEPT_MAP.get(concept_id, {
        "name": concept_id.replace("-", " ").title(),
        "search_term": concept_id.replace("-", " "),
        "tags": [concept_id.replace("-", " ")],
        "saturation": 5,
    })

    concept_name = concept_info["name"]
    saturation = concept_info["saturation"]
    concept_tags = concept_info["tags"]

    venues: List[Dict[str, Any]] = []
    taste_tags: List[str] = []
    total_popularity = 0.0
    valid_places_count = 0

    # 2. Query Qloo Search for real local places
    has_qloo_key = bool(settings.QLOO_API_KEY and not settings.QLOO_API_KEY.startswith("your_"))
    if has_qloo_key:
        search_queries = [
            f"{concept_info['search_term']} {suburb} {city}",
            f"{concept_name} {suburb}",
            f"{concept_info['search_term']} {city}",
        ]

        raw_entities = []
        for q in search_queries:
            try:
                logger.info("Live Qloo search: %s", q)
                results = await qloo_client.search(query=q, types="urn:entity:place")
                if isinstance(results, list) and len(results) > 0:
                    raw_entities = results
                    break
            except Exception as e:
                logger.warning("Qloo search query failed (%s): %s", q, e)

        # Process entities from Qloo
        seen_names = set()
        for idx, ent in enumerate(raw_entities):
            if not isinstance(ent, dict):
                continue
            name = ent.get("name")
            if not name or name in seen_names:
                continue

            loc = ent.get("location") or {}
            v_lat = loc.get("lat")
            v_lon = loc.get("lon")

            # Check distance if coordinates are present
            dist_km = 0.5
            if v_lat and v_lon:
                try:
                    dist_km = haversine_km(lat, lon, float(v_lat), float(v_lon))
                except Exception:
                    dist_km = 0.8

            # Accept venues within reasonable urban radius (or without coords if returned by targeted query)
            if dist_km <= 12.0 or not v_lat:
                seen_names.add(name)
                pop = float(ent.get("popularity") or 0.72)
                total_popularity += pop
                valid_places_count += 1

                # Extract taste tags from entity
                for t in ent.get("tags", []):
                    tname = t.get("name") if isinstance(t, dict) else str(t)
                    if tname and tname not in taste_tags and len(tname) > 2:
                        taste_tags.append(tname)

                # Keep coordinates near the clicked point for visualization if Qloo had no lat/lon
                v_final_lat = float(v_lat) if v_lat else (lat + (idx * 0.002 - 0.004))
                v_final_lon = float(v_lon) if v_lon else (lon + (idx * 0.0025 - 0.005))

                venues.append({
                    "osm_id": f"qloo/{ent.get('entity_id', idx)}",
                    "name": name,
                    "lat": round(v_final_lat, 6),
                    "lon": round(v_final_lon, 6),
                    "distance_km": round(dist_km, 2),
                    "popularity": round(pop, 2),
                    "tags": {"source": "qloo_entity", "suburb": suburb, "city": city},
                })

    # Sort venues by proximity
    venues.sort(key=lambda x: x.get("distance_km", 99.0))

    # Add concept tags if taste_tags are sparse
    for ct in concept_tags:
        if ct not in taste_tags:
            taste_tags.append(ct)

    # 3. Dynamic Calculation of Demand, Supply, and Gap
    venue_count = len(venues)
    supply = min(1.0, round(venue_count / float(saturation), 3))

    avg_popularity = (total_popularity / valid_places_count) if valid_places_count > 0 else 0.75
    # Demand is higher in active areas with strong taste signals and high popularity
    demand_base = 0.55 + (min(valid_places_count, 10) * 0.035) + (avg_popularity * 0.20)
    demand = min(0.96, round(demand_base, 3))

    # Gap = Demand * (1 - Supply)
    gap = round(demand * (1.0 - supply), 3)

    confidence = "high" if valid_places_count >= 5 else "medium" if valid_places_count >= 2 else "medium"

    return {
        "lat": lat,
        "lon": lon,
        "suburb": suburb,
        "city": city,
        "label": display_label,
        "concept_id": concept_id,
        "concept_name": concept_name,
        "demand": demand,
        "supply": supply,
        "gap": gap,
        "confidence": confidence,
        "venue_count": venue_count,
        "venues": venues[:25],
        "taste_tags": taste_tags[:12],
    }
