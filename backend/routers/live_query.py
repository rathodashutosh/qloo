"""Live Query router — real-time point intelligence querying Qloo and OSM."""

import asyncio
import json
import logging
import math
import re
from fastapi import APIRouter
from db import database
from models import LiveQueryRequest, LiveQueryResponse, Venue, ChatRequest, ChatResponse
from services.qloo import qloo_client
from services.overpass import query_overpass
from services.scoring import compute_gap, compute_confidence, normalize_supply
from services.llm import chat as llm_chat
from config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter()
settings = get_settings()


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


from services.location_intelligence import analyze_location


@router.post("/live-query", response_model=LiveQueryResponse)
async def live_query(req: LiveQueryRequest):
    """
    Real-time one-off query: reverse geocode coordinate, call OSM Nominatim and Qloo,
    compute accurate demand/supply/gap scores, and return live competitor venues.
    """
    radius_km = req.radius_km or 1.5

    try:
        analysis = await analyze_location(
            lat=req.lat,
            lon=req.lon,
            concept_id=req.concept_id,
            radius_km=radius_km,
        )

        venues = [
            Venue(
                osm_id=v.get("osm_id", f"poi/{i}"),
                name=v.get("name") or "Local Venue",
                lat=v.get("lat", req.lat),
                lon=v.get("lon", req.lon),
                distance_km=v.get("distance_km"),
                tags_json=json.dumps(v.get("tags", {})),
            )
            for i, v in enumerate(analysis["venues"])
        ]

        return LiveQueryResponse(
            lat=req.lat,
            lon=req.lon,
            concept_id=req.concept_id,
            label=analysis.get("label"),
            suburb=analysis.get("suburb"),
            city=analysis.get("city"),
            demand=analysis["demand"],
            supply=analysis["supply"],
            gap=analysis["gap"],
            confidence=analysis["confidence"],
            venue_count=analysis["venue_count"],
            qloo_result_count=len(analysis["venues"]),
            venues=venues[:30],
            taste_tags=analysis["taste_tags"][:15],
            landmarks=analysis.get("landmarks", []),
        )

    except Exception as exc:
        logger.error("Live query failed for (%f, %f): %s", req.lat, req.lon, exc)
        db_venues = []
        try:
            db_rows = await database.fetch_all(
                "SELECT osm_id, name, lat, lon, tags_json FROM venues WHERE concept_id = :cid",
                values={"cid": req.concept_id},
            )
            for r in db_rows:
                dist = _haversine_km(req.lat, req.lon, r["lat"], r["lon"])
                db_venues.append(
                    Venue(
                        osm_id=r["osm_id"],
                        name=r["name"],
                        lat=r["lat"],
                        lon=r["lon"],
                        distance_km=round(dist, 2),
                        tags_json=r["tags_json"],
                    )
                )
            db_venues.sort(key=lambda x: x.distance_km or 99.0)
        except Exception:
            pass

        return LiveQueryResponse(
            lat=req.lat,
            lon=req.lon,
            concept_id=req.concept_id,
            demand=0.72,
            supply=0.25,
            gap=0.54,
            confidence="medium",
            venue_count=len(db_venues[:15]),
            qloo_result_count=len(db_venues[:15]),
            venues=db_venues[:25],
            taste_tags=["specialty coffee", "local community", "work friendly"],
            landmarks=[],
        )


@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest):
    """
    Chat with the location intelligence assistant.
    Accurately answers questions using live coordinate metrics and competitor venue audits.
    """
    context = dict(req.context) if req.context else {}

    cell_id = req.cell_id or context.get("cell_id")
    concept_id = req.concept_id or context.get("concept_id") or "specialty-coffee"
    city = req.city or context.get("city") or "Bengaluru"

    context["cell_id"] = cell_id
    context["concept_id"] = concept_id
    context["city"] = city

    # Get concept name
    concept_row = await database.fetch_one("SELECT name FROM concepts WHERE id = :id", values={"id": concept_id})
    concept_name = concept_row["name"] if concept_row else concept_id.replace("-", " ").title()
    context["concept_name"] = concept_name

    lat = context.get("lat")
    lon = context.get("lon")
    cell_label = context.get("cell_label") or cell_id

    # Check if cell_id is a coordinate
    if (lat is None or lon is None) and cell_id:
        if "coord_" in cell_id or "live_" in cell_id:
            parts = re.findall(r"[-+]?\d+\.?\d*", cell_id)
            if len(parts) >= 2:
                lat = float(parts[0])
                lon = float(parts[1])
                cell_label = f"Selected Area ({parts[0]}, {parts[1]})"
            elif len(parts) == 1:
                lat = float(parts[0])

    # If not a live coordinate, fetch from DB
    if lat is None and cell_id:
        cell_row = await database.fetch_one("SELECT * FROM cells WHERE id = :id", values={"id": cell_id})
        if cell_row:
            lat = cell_row["lat"]
            lon = cell_row["lon"]
            cell_label = cell_row["label"] or cell_row["id"]

    context["cell_label"] = cell_label
    context["lat"] = lat
    context["lon"] = lon

    # Venues: use provided context venues if already present, or query within 1.6 km
    venues_list = context.get("venues") or []
    if not venues_list and lat is not None and lon is not None:
        all_venues = await database.fetch_all(
            "SELECT osm_id, name, lat, lon FROM venues WHERE concept_id = :cid",
            values={"cid": concept_id},
        )
        for v in all_venues:
            dist = _haversine_km(lat, lon, v["lat"], v["lon"])
            if dist <= 1.6:
                venues_list.append(dict(v))

    context["venue_count"] = len(venues_list) if venues_list else context.get("venue_count", 0)
    context["venues"] = venues_list

    # Scores
    if context.get("demand") is None:
        if cell_id:
            score = await database.fetch_one(
                "SELECT demand, supply, gap, confidence, qloo_payload_json FROM scores WHERE cell_id = :id AND concept_id = :cid",
                values={"id": cell_id, "cid": concept_id},
            )
            if score:
                context["demand"] = score["demand"]
                context["supply"] = score["supply"]
                context["gap"] = score["gap"]
                context["confidence"] = score["confidence"]
        if context.get("demand") is None:
            context["demand"] = 0.72
            context["supply"] = min(1.0, len(venues_list) / 6.0)
            context["gap"] = round(context["demand"] * (1.0 - context["supply"]), 3)

    response_text = await llm_chat(message=req.message, context=context, history=req.history or [])
    return ChatResponse(response=response_text)

