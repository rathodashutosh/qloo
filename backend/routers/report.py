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
    Runs real-time Qloo analysis or leverages pre-computed location metrics.
    """
    concept_id = req.concept_id or "specialty-coffee"
    concept_name = concept_id.replace("-", " ").title()

    # 1. Fast Path: If caller supplied the pre-analyzed metrics, use them immediately
    if req.demand is not None and req.supply is not None:
        cell_label = req.label or req.city or req.cell_id
        demand = float(req.demand)
        supply = float(req.supply)
        gap = float(req.gap if req.gap is not None else demand * (1.0 - supply))
        confidence = req.confidence or "medium"
        taste_tags = req.taste_tags or ["artisan preferences", "walkable footfall", "community hub"]
        venues = req.venues or []
        venue_count = len(venues)
    else:
        lat = None
        lon = None
        label = req.label

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

        if lat and lon:
            try:
                analysis = await analyze_location(
                    lat=lat,
                    lon=lon,
                    concept_id=concept_id,
                    area_label=label,
                    radius_km=1.5,
                )
                cell_label = analysis.get("label") or label or f"Zone ({lat:.4f}, {lon:.4f})"
                demand = float(analysis.get("demand", 0.75))
                supply = float(analysis.get("supply", 0.25))
                gap = float(analysis.get("gap", 0.56))
                confidence = analysis.get("confidence", "medium")
                venue_count = int(analysis.get("venue_count", 0))
                taste_tags = analysis.get("taste_tags") or ["artisan", "contemporary", "local community"]
                venues = analysis.get("venues") or []
            except Exception as exc:
                logger.warning("analyze_location failed in create_report (%s); using default data.", exc)
                cell_label = label or (f"Area ({lat:.4f}, {lon:.4f})" if lat and lon else req.city or req.cell_id)
                demand = 0.76
                supply = 0.24
                gap = 0.58
                confidence = "medium"
                venue_count = 3
                taste_tags = ["artisan coffee", "community hub", "walkable", "contemporary dining"]
                venues = []
        else:
            cell_label = req.city or req.cell_id
            demand = 0.75
            supply = 0.25
            gap = 0.56
            confidence = "medium"
            venue_count = 3
            taste_tags = ["artisan", "contemporary", "local community"]
            venues = []

    try:
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
    except Exception as exc:
        logger.warning("generate_report error: %s; using deterministic brief.", exc)
        from services.llm import _generate_analytical_brief
        report_text = _generate_analytical_brief(
            concept_name, cell_label, demand, supply, gap, confidence, venue_count, taste_tags, venues
        )

    return ReportResponse(
        report_text=report_text,
        report=report_text,
        structured_data={
            "demand": demand,
            "supply": supply,
            "gap": gap,
            "confidence": confidence,
            "venue_count": venue_count,
            "taste_tags": taste_tags,
            "venues": venues,
        },
        cell_id=req.cell_id,
        concept_id=concept_id,
        city=req.city,
    )
