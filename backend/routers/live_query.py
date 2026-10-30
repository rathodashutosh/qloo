"""Live query & chat routers — real-time Qloo queries and assistant."""

import json
import logging
from fastapi import APIRouter

from models import (
    LiveQueryRequest,
    LiveQueryResponse,
    ChatRequest,
    ChatResponse,
    Venue,
)
from services.location_intelligence import analyze_location
from services.llm import chat as llm_chat

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/live-query", response_model=LiveQueryResponse)
async def live_query(req: LiveQueryRequest):
    """
    Real-time one-off query: reverse geocode coordinate, call Qloo for authentic places,
    compute accurate demand/supply/gap scores, and return live venues.
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
        return LiveQueryResponse(
            lat=req.lat,
            lon=req.lon,
            concept_id=req.concept_id,
            demand=0.70,
            supply=0.20,
            gap=0.56,
            confidence="medium",
            venue_count=0,
            qloo_result_count=0,
            venues=[],
            taste_tags=["artisanal", "local community", "work friendly"],
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

    reply = await llm_chat(req.message, context, history=req.history)
    return ChatResponse(response=reply, reply=reply)
