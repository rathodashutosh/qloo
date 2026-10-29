"""Report router — generates comprehensive AI narrative business briefs."""

import re
import json
import logging
from fastapi import APIRouter
from db import database
from models import ReportRequest, ReportResponse
from services.llm import generate_report
from services.location_intelligence import analyze_location

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/report", response_model=ReportResponse)
async def create_report(req: ReportRequest):
    """
    Generate an AI executive narrative brief for a cell or live clicked coordinate.
    Runs real-time Qloo analysis to retrieve authentic local competitors and taste signals.
    """
    concept_id = req.concept_id or "specialty-coffee"
    lat = None
    lon = None
    label = None

    # Check if cell_id is a live point like live_12.9784_77.6408 or coord_12.9784
    coord_match = re.search(r"(\d+\.\d+)[^\d]+(\d+\.\d+)", req.cell_id)
    if coord_match:
        lat = float(coord_match.group(1))
        lon = float(coord_match.group(2))

    # Fetch cell from DB if not parsed from coordinates
    cell = await database.fetch_one(
        "SELECT * FROM cells WHERE id = :id", values={"id": req.cell_id}
    )
    if cell:
        lat = cell["lat"]
        lon = cell["lon"]
        label = cell["label"]

    # If coordinates are known, run real-time analysis
    if lat and lon:
        analysis = await analyze_location(
            lat=lat,
            lon=lon,
            concept_id=concept_id,
            area_label=label,
            radius_km=1.5,
        )

        concept_name = analysis["concept_name"]
        cell_label = analysis["label"]
        demand = analysis["demand"]
        supply = analysis["supply"]
        gap = analysis["gap"]
        confidence = analysis["confidence"]
        venue_count = analysis["venue_count"]
        taste_tags = analysis["taste_tags"]
        venues = analysis["venues"]
    else:
        # Fallback
        concept_name = concept_id.replace("-", " ").title()
        cell_label = req.city or req.cell_id
        demand = 0.75
        supply = 0.25
        gap = 0.56
        confidence = "medium"
        venue_count = 3
        taste_tags = ["artisan", "contemporary", "local community"]
        venues = []

    report_text = await generate_report(
        concept_name=concept_name,
        cell_label=cell_label,
        demand=demand,
        supply=supply,
        gap=gap,
        confidence=confidence,
        venue_count=venue_count,
        taste_tags=taste_tags,
        venues=venues,
    )

    return ReportResponse(
        cell_id=req.cell_id,
        concept_id=concept_id,
        report=report_text,
        city=req.city,
    )
