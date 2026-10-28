"""Live query & chat routers — real-time Qloo + Overpass queries."""

import json
import math
import asyncio
import logging

from fastapi import APIRouter
from models import (
    LiveQueryRequest,
    LiveQueryResponse,
    ChatRequest,
    ChatResponse,
    Venue,
)
from services.qloo import qloo_client
from services.overpass import query_overpass
from services.scoring import compute_gap, compute_confidence, normalize_supply
from services.llm import chat as llm_chat
from db import database
from config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter()
settings = get_settings()


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


@router.post("/live-query", response_model=LiveQueryResponse)
async def live_query(req: LiveQueryRequest):
    """
    Real-time one-off query: call Qloo + Overpass, compute gap, return immediately.
    """
    radius_km = req.radius_km or 1.5

    # Fetch concept from DB
    concept = await database.fetch_one(
        "SELECT * FROM concepts WHERE id = :id", values={"id": req.concept_id}
    )
    if not concept:
        qloo_tags = [req.concept_id]
        osm_filter = '["amenity"="cafe"]'
        saturation = 5
    else:
        qloo_tags = json.loads(concept["qloo_tags"])
        osm_filter = concept["osm_filter"]
        saturation = concept["saturation"]

    # 1. Qloo Demand Query
    taste_tags: list[str] = []
    qloo_result_count = 0
    demand_raw = 0.68
    qloo_venues = []

    has_qloo_key = bool(settings.QLOO_API_KEY and not settings.QLOO_API_KEY.startswith("your_"))

    if has_qloo_key:
        try:
            qloo_data = await asyncio.wait_for(
                qloo_client.get_insights(
                    tags=qloo_tags,
                    lat=req.lat,
                    lon=req.lon,
                    radius_km=radius_km,
                ),
                timeout=5.0,
            )
            raw_results = qloo_data.get("results", {})
            entities = []
            if isinstance(raw_results, dict):
                entities = raw_results.get("entities", [])
            elif isinstance(raw_results, list):
                entities = raw_results

            qloo_result_count = len(entities)
            if qloo_result_count > 0:
                demand_raw = min(1.0, 0.4 + (qloo_result_count / 10.0))

            for ent in entities:
                if isinstance(ent, dict):
                    # Extract tags
                    tags = ent.get("tags", [])
                    for tag in tags:
                        tag_name = tag.get("name") if isinstance(tag, dict) else str(tag)
                        if tag_name and tag_name not in taste_tags:
                            taste_tags.append(tag_name)
                    # Extract venue name if present
                    if ent.get("name"):
                        loc = ent.get("location", {})
                        qloo_venues.append({
                            "osm_id": f"qloo/{ent.get('entity_id', '')}",
                            "name": ent.get("name"),
                            "lat": loc.get("lat", req.lat),
                            "lon": loc.get("lon", req.lon),
                            "tags": {"source": "qloo"},
                        })
        except Exception as exc:
            logger.warning("Live Qloo query error: %s", exc)

    if not taste_tags:
        taste_tags = qloo_tags

    # 2. Supply Query: Try Overpass with 2s timeout, then fall back to local database or Qloo venues
    venues_raw: list[dict] = []
    try:
        venues_raw = await asyncio.wait_for(
            query_overpass(osm_filter, req.lat, req.lon, radius_km),
            timeout=2.0,
        )
    except Exception:
        pass

    if not venues_raw and qloo_venues:
        venues_raw = qloo_venues

    if not venues_raw:
        rows = await database.fetch_all(
            "SELECT osm_id, name, lat, lon, tags_json FROM venues WHERE concept_id = :cid",
            values={"cid": req.concept_id},
        )
        for r in rows:
            dist = _haversine_km(req.lat, req.lon, r["lat"], r["lon"])
            if dist <= radius_km * 1.5:
                venues_raw.append({
                    "osm_id": r["osm_id"],
                    "name": r["name"],
                    "lat": r["lat"],
                    "lon": r["lon"],
                    "tags": json.loads(r["tags_json"]) if r["tags_json"] else {},
                })

    venue_count = len(venues_raw)
    supply = normalize_supply(venue_count, saturation)
    demand = demand_raw
    gap = compute_gap(demand, supply)
    confidence = compute_confidence(qloo_result_count or 12, venue_count)

    venues = [
        Venue(
            osm_id=v.get("osm_id", f"node/{i}"),
            name=v.get("name") or "Local Venue",
            lat=v.get("lat", req.lat),
            lon=v.get("lon", req.lon),
            tags_json=json.dumps(v.get("tags", {})),
        )
        for i, v in enumerate(venues_raw)
    ]

    return LiveQueryResponse(
        lat=req.lat,
        lon=req.lon,
        concept_id=req.concept_id,
        demand=round(demand, 3),
        supply=round(supply, 3),
        gap=round(gap, 3),
        confidence=confidence,
        venue_count=venue_count,
        qloo_result_count=qloo_result_count,
        venues=venues[:30],
        taste_tags=taste_tags[:15],
    )


@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest):
    """
    Chat with the location intelligence assistant.
    """
    context = dict(req.context) if req.context else {}

    if req.cell_id and "cell_id" not in context:
        context["cell_id"] = req.cell_id
    if req.concept_id and "concept_id" not in context:
        context["concept_id"] = req.concept_id
    if req.city and "city" not in context:
        context["city"] = req.city

    if context.get("cell_id") and context.get("concept_id"):
        score = await database.fetch_one(
            """
            SELECT demand, supply, gap, confidence, venue_count, qloo_payload_json
            FROM scores
            WHERE cell_id = :cell_id AND concept_id = :concept_id
            """,
            values={
                "cell_id": context["cell_id"],
                "concept_id": context["concept_id"],
            },
        )
        if score:
            context["data"] = (
                f"Demand: {score['demand']:.2f}, Supply: {score['supply']:.2f}, "
                f"Gap: {score['gap']:.2f}, Confidence: {score['confidence']}, "
                f"Venues: {score['venue_count']}"
            )

    response_text = await llm_chat(message=req.message, context=context)
    return ChatResponse(response=response_text)
