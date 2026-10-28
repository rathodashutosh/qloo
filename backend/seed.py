"""
Seed script: precompute demand/supply/gap data for Indian & Global hubs:
- Bengaluru (Bangalore)
- Mumbai
- Delhi NCR
- New York City

Generates H3 hex grid cells, queries Qloo (or taste profiles), computes scores,
and stores everything in SQLite.

Usage:
    python seed.py
"""

import asyncio
import json
import time
import random
import logging
import sys

from config import get_settings
from db import init_db, connect_db, disconnect_db, database
from services.grid import generate_hex_grid
from services.qloo import qloo_client
from services.overpass import query_overpass
from services.scoring import (
    compute_gap,
    compute_confidence,
    normalize_demand,
    normalize_supply,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

settings = get_settings()

DEMO_CITIES = [
    {"name": "Bengaluru", "lat": 12.9716, "lon": 77.5946, "radius_km": 6.5},
    {"name": "Mumbai", "lat": 19.0760, "lon": 72.8777, "radius_km": 7.0},
    {"name": "Delhi NCR", "lat": 28.6139, "lon": 77.2090, "radius_km": 7.5},
    {"name": "New York City", "lat": 40.7128, "lon": -74.0060, "radius_km": 6.5},
]

SEED_CONCEPTS = [
    {
        "id": "specialty-coffee",
        "name": "Specialty Coffee",
        "description": "Third-wave, artisan, and single-origin coffee shops",
        "qloo_tags": ["specialty coffee", "third wave coffee", "espresso bar", "single origin"],
        "osm_filter": '["amenity"="cafe"]["cuisine"~"coffee"] or ["amenity"="cafe"]',
        "saturation": 8,
    },
    {
        "id": "live-music-venue",
        "name": "Live Music Venue",
        "description": "Venues with live music performances and acoustic gigs",
        "qloo_tags": ["live music", "jazz club", "indie music", "music venue"],
        "osm_filter": '["amenity"="nightclub"]["music"="live"] or ["amenity"="pub"]["live_music"="yes"]',
        "saturation": 4,
    },
    {
        "id": "board-game-cafe",
        "name": "Board Game Cafe",
        "description": "Cafes with board games and tabletop gaming",
        "qloo_tags": ["board games", "tabletop gaming", "game cafe", "social club"],
        "osm_filter": '["amenity"="cafe"]["board_games"="yes"] or ["leisure"="board_game"]',
        "saturation": 3,
    },
    {
        "id": "bookstore-cafe",
        "name": "Bookstore Cafe",
        "description": "Bookstores with cafe / book cafes",
        "qloo_tags": ["bookstore", "book cafe", "literary", "independent bookstore"],
        "osm_filter": '["shop"="books"]',
        "saturation": 4,
    },
    {
        "id": "vegan-restaurant",
        "name": "Vegan Restaurant",
        "description": "Plant-based, organic, and clean dining",
        "qloo_tags": ["vegan", "plant-based", "vegan restaurant", "organic dining"],
        "osm_filter": '["amenity"="restaurant"]["diet:vegan"~"yes|only"] or ["cuisine"~"vegan"]',
        "saturation": 5,
    },
    {
        "id": "coworking-cafe",
        "name": "Co-working Cafe",
        "description": "Coworking spaces and remote-work-friendly cafes",
        "qloo_tags": ["coworking", "remote work", "digital nomad", "laptop friendly"],
        "osm_filter": '["amenity"="coworking_space"] or ["office"="coworking"]',
        "saturation": 4,
    },
    {
        "id": "craft-brewery",
        "name": "Craft Brewery",
        "description": "Microbreweries and craft beer taprooms",
        "qloo_tags": ["craft beer", "microbrewery", "brewery taproom", "ipa"],
        "osm_filter": '["craft"="brewery"] or ["microbrewery"="yes"]',
        "saturation": 4,
    },
    {
        "id": "natural-wine-bar",
        "name": "Natural Wine Bar",
        "description": "Natural and organic wine & cocktail bars",
        "qloo_tags": ["natural wine", "wine bar", "organic wine", "biodynamic"],
        "osm_filter": '["amenity"="bar"]["drink"~"wine"] or ["amenity"="bar"]',
        "saturation": 4,
    },
]

SAMPLE_VENUES = {
    "specialty-coffee": [
        "Blue Tokai Coffee Roasters", "Third Wave Coffee", "Subko Coffee Roasters",
        "Araku Coffee", "Maverick & Farmer Coffee", "Brik Oven Coffee & Bakes",
        "Kcroasters", "Roastery Coffee House", "Sey Coffee", "Devoción"
    ],
    "live-music-venue": [
        "The Piano Man Jazz Club", "Fandom at Gilly's", "antiSOCIAL",
        "Hard Rock Cafe", "Blue Note Jazz Club", "Bowery Ballroom"
    ],
    "board-game-cafe": [
        "Dialogues Cafe Koramangala", "The Board Room Cafe", "Pair a Dice Cafe",
        "Creeda Board Game Cafe", "Hex & Company", "The Uncommons"
    ],
    "bookstore-cafe": [
        "Atta Galatta", "Champaca Bookstore & Cafe", "Kitab Khana Fort",
        "Title Waves Bandra", "Fakir Chand Bookstore", "Strand Book Store"
    ],
    "vegan-restaurant": [
        "Carrots Restaurant", "Earth Cafe Bandra", "Greenr Cafe",
        "Sante Spa Cuisine", "Burma Burma", "Dirt Candy", "Planta Queen"
    ],
    "coworking-cafe": [
        "WeWork Galaxy", "Church Street Social", "Koramangala Social",
        "91springboard Indiranagar", "AntiSocial Lower Parel", "Drip Work Lounge"
    ],
    "craft-brewery": [
        "Toit Brewpub", "Geist Brewing Co", "Byg Brewski", "Windmills Craftworks",
        "Arbor Brewing Company", "Doolally Taproom", "Effingut", "Ironhill"
    ],
    "natural-wine-bar": [
        "Perch Wine & Coffee Bar", "Sula Wine Lounge", "The Table Colaba",
        "Olive Bar & Kitchen", "The Four Horsemen", "Ruffian"
    ],
}


async def seed_concepts_to_db():
    for c in SEED_CONCEPTS:
        await database.execute(
            """
            INSERT OR REPLACE INTO concepts (id, name, description, qloo_tags, osm_filter, saturation)
            VALUES (:id, :name, :description, :qloo_tags, :osm_filter, :saturation)
            """,
            values={
                "id": c["id"],
                "name": c["name"],
                "description": c["description"],
                "qloo_tags": json.dumps(c["qloo_tags"]),
                "osm_filter": c["osm_filter"],
                "saturation": c["saturation"],
            },
        )
    logger.info("Seeded %d concepts.", len(SEED_CONCEPTS))


def _get_cultural_weight(label: str, concept_id: str, city: str) -> float:
    label_lower = label.lower()
    city_lower = city.lower()

    # Bengaluru weighting
    if "bengaluru" in city_lower or "bangalore" in city_lower:
        if concept_id == "craft-brewery" and any(x in label_lower for x in ["indiranagar", "koramangala", "hsr", "lavelle"]):
            return 0.94
        if concept_id == "specialty-coffee" and any(x in label_lower for x in ["indiranagar", "koramangala", "church", "lavelle"]):
            return 0.95
        if concept_id == "coworking-cafe" and any(x in label_lower for x in ["hsr", "bellandur", "koramangala", "indiranagar"]):
            return 0.92
        if concept_id == "board-game-cafe" and any(x in label_lower for x in ["koramangala", "jayanagar", "jp nagar"]):
            return 0.88

    # Mumbai weighting
    elif "mumbai" in city_lower:
        if concept_id in ["natural-wine-bar", "vegan-restaurant"] and any(x in label_lower for x in ["bandra", "lower parel", "colaba"]):
            return 0.93
        if concept_id == "live-music-venue" and any(x in label_lower for x in ["lower parel", "bandra", "andheri"]):
            return 0.90
        if concept_id == "specialty-coffee" and any(x in label_lower for x in ["bandra", "bkc", "juhu", "fort"]):
            return 0.92

    # Default cultural weight
    base = 0.60
    return max(0.25, min(0.98, base + random.uniform(-0.15, 0.18)))


async def seed_city(city_config: dict):
    city_name = city_config["name"]
    lat = city_config["lat"]
    lon = city_config["lon"]
    radius = city_config["radius_km"]

    logger.info("Processing city: %s (%.4f, %.4f) r=%.1fkm", city_name, lat, lon, radius)
    cells = generate_hex_grid(lat, lon, radius, city_name=city_name)

    city_slug = city_name.lower().replace(" ", "_")

    for cell in cells:
        cell_id = f"{city_slug}_{cell['h3_index']}"
        await database.execute(
            """
            INSERT OR REPLACE INTO cells (id, city, lat, lon, radius_km, label, h3_index)
            VALUES (:id, :city, :lat, :lon, :radius_km, :label, :h3_index)
            """,
            values={
                "id": cell_id,
                "city": city_name,
                "lat": cell["lat"],
                "lon": cell["lon"],
                "radius_km": cell["radius_km"],
                "label": cell["label"],
                "h3_index": cell["h3_index"],
            },
        )

    all_results = []
    has_real_qloo = bool(settings.QLOO_API_KEY and not settings.QLOO_API_KEY.startswith("your_"))

    for cell_idx, cell in enumerate(cells):
        cell_id = f"{city_slug}_{cell['h3_index']}"
        cell_label = cell["label"]

        for concept in SEED_CONCEPTS:
            cid = concept["id"]
            qloo_tags = concept["qloo_tags"]
            saturation = concept["saturation"]

            qloo_result_count = 0
            demand_raw = 0.0
            qloo_data = {}

            if has_real_qloo:
                try:
                    qloo_data = await qloo_client.get_insights(
                        tags=qloo_tags,
                        lat=cell["lat"],
                        lon=cell["lon"],
                        radius_km=cell["radius_km"],
                    )
                    results = qloo_data.get("results", [])
                    qloo_result_count = len(results)
                    demand_raw = float(qloo_result_count)
                except Exception:
                    has_real_qloo = False

            if not has_real_qloo:
                weight = _get_cultural_weight(cell_label, cid, city_name)
                qloo_result_count = int(weight * 20)
                demand_raw = weight * 100.0
                qloo_data = {
                    "results": [{"name": f"{concept['name']} Spot {i}", "tags": [{"name": t} for t in qloo_tags]} for i in range(max(2, qloo_result_count))],
                    "tags": qloo_tags,
                }

            # Seed authentic local competitor venues
            sample_pool = SAMPLE_VENUES.get(cid, ["Local Favorite", "Corner Place"])
            # Some neighborhoods are saturated, some are prime opportunity zones
            is_opportunity = any(k in cell_label.lower() for k in ["hsr", "jp nagar", "bellandur", "bkc", "powai", "saket", "bushwick", "astoria"])
            num_venues = random.choice([0, 1, 2]) if is_opportunity else random.choice([2, 3, 4, 6])
            chosen_names = random.sample(sample_pool, min(num_venues, len(sample_pool)))

            venues_raw = []
            for i, name in enumerate(chosen_names):
                v_id = f"v_{cell['h3_index']}_{cid}_{i}"
                v_lat = cell["lat"] + random.uniform(-0.003, 0.003)
                v_lon = cell["lon"] + random.uniform(-0.003, 0.003)
                venues_raw.append({"osm_id": v_id, "name": name, "lat": v_lat, "lon": v_lon})

                await database.execute(
                    """
                    INSERT OR REPLACE INTO venues (osm_id, cell_id, concept_id, name, lat, lon, tags_json)
                    VALUES (:osm_id, :cell_id, :concept_id, :name, :lat, :lon, :tags_json)
                    """,
                    values={
                        "osm_id": v_id,
                        "cell_id": cell_id,
                        "concept_id": cid,
                        "name": name,
                        "lat": v_lat,
                        "lon": v_lon,
                        "tags_json": json.dumps({"amenity": "cafe", "name": name}),
                    },
                )

            venue_count = len(venues_raw)
            supply = normalize_supply(venue_count, saturation)

            all_results.append({
                "cell_id": cell_id,
                "concept_id": cid,
                "demand_raw": demand_raw,
                "supply": supply,
                "venue_count": venue_count,
                "qloo_result_count": qloo_result_count,
                "qloo_payload_json": json.dumps(qloo_data),
            })

    # Normalize demand for this city
    for concept in SEED_CONCEPTS:
        c_res = [r for r in all_results if r["concept_id"] == concept["id"]]
        raw_vals = [r["demand_raw"] for r in c_res]
        normalized = normalize_demand(raw_vals)

        now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        for i, res in enumerate(c_res):
            demand = normalized[i] if i < len(normalized) else 0.5
            supply = res["supply"]
            gap = compute_gap(demand, supply)
            confidence = compute_confidence(res["qloo_result_count"], res["venue_count"])

            await database.execute(
                """
                INSERT OR REPLACE INTO scores
                    (cell_id, concept_id, demand, supply, gap, confidence,
                     venue_count, qloo_result_count, qloo_payload_json, updated_at)
                VALUES (:cell_id, :concept_id, :demand, :supply, :gap, :confidence,
                        :venue_count, :qloo_result_count, :qloo_payload_json, :updated_at)
                """,
                values={
                    "cell_id": res["cell_id"],
                    "concept_id": res["concept_id"],
                    "demand": round(demand, 4),
                    "supply": round(supply, 4),
                    "gap": round(gap, 4),
                    "confidence": confidence,
                    "venue_count": res["venue_count"],
                    "qloo_result_count": res["qloo_result_count"],
                    "qloo_payload_json": res["qloo_payload_json"],
                    "updated_at": now,
                },
            )

    logger.info("City %s seed complete: %d cells, %d scores.", city_name, len(cells), len(all_results))


async def main():
    start_time = time.time()
    logger.info("=" * 60)
    logger.info("Taste-Gap Finder — Multi-City Seeder (India & Global)")
    logger.info("=" * 60)

    await init_db()
    await connect_db()

    try:
        await seed_concepts_to_db()
        for city_config in DEMO_CITIES:
            await seed_city(city_config)

        elapsed = time.time() - start_time
        logger.info("=" * 60)
        logger.info("All cities seeded successfully in %.1f seconds!", elapsed)
        logger.info("=" * 60)
    finally:
        await qloo_client.close()
        await disconnect_db()


if __name__ == "__main__":
    asyncio.run(main())
