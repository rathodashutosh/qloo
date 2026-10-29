"""Report router — LLM-generated narrative reports."""

import json
import logging

from fastapi import APIRouter, HTTPException
from db import database
from models import ReportRequest, ReportResponse
from services.llm import generate_report

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/report", response_model=ReportResponse)
async def create_report(req: ReportRequest):
    """
    Generate an LLM-powered business brief for a cell × concept.
    """
    # Fetch cell info
    cell = await database.fetch_one(
        "SELECT * FROM cells WHERE id = :id", values={"id": req.cell_id}
    )
    if not cell:
        # Check if cell exists with prefix or partial match
        cell = await database.fetch_one(
            "SELECT * FROM cells WHERE id LIKE :id_pattern LIMIT 1",
            values={"id_pattern": f"%{req.cell_id}%"},
        )
    if not cell:
        # Fallback cell structure
        cell = {"id": req.cell_id, "label": req.cell_id}

    # Fetch concept
    concept = await database.fetch_one(
        "SELECT * FROM concepts WHERE id = :id", values={"id": req.concept_id}
    )
    if not concept:
        concept = {"id": req.concept_id, "name": req.concept_id.replace("-", " ").title()}

    # Fetch score
    score = await database.fetch_one(
        """
        SELECT demand, supply, gap, confidence, venue_count, qloo_payload_json
        FROM scores
        WHERE cell_id = :cell_id AND concept_id = :concept_id
        """,
        values={"cell_id": req.cell_id, "concept_id": req.concept_id},
    )

    demand = score["demand"] if score and score["demand"] is not None else 0.65
    supply = score["supply"] if score and score["supply"] is not None else 0.30
    gap = score["gap"] if score and score["gap"] is not None else (demand * (1.0 - supply))
    confidence = score["confidence"] if score and score["confidence"] else "medium"
    venue_count = score["venue_count"] if score and score["venue_count"] is not None else 3

    # Extract taste tags
    taste_tags: list[str] = []
    if score and score["qloo_payload_json"]:
        try:
            payload = json.loads(score["qloo_payload_json"])
            results = payload.get("results", [])
            for result in results:
                tags = result.get("tags", [])
                for tag in tags:
                    tag_name = tag.get("name", "") if isinstance(tag, dict) else str(tag)
                    if tag_name and tag_name not in taste_tags:
                        taste_tags.append(tag_name)
        except (json.JSONDecodeError, TypeError):
            pass

    concept_dict = dict(concept) if concept else {}
    if not taste_tags and concept_dict.get("qloo_tags"):
        try:
            val = concept_dict["qloo_tags"]
            taste_tags = json.loads(val) if isinstance(val, str) else list(val)
        except Exception:
            pass

    # Fetch venues
    venue_rows = await database.fetch_all(
        """
        SELECT osm_id, name, lat, lon, tags_json
        FROM venues
        WHERE cell_id = :cell_id AND concept_id = :concept_id
        """,
        values={"cell_id": req.cell_id, "concept_id": req.concept_id},
    )
    venues = [dict(row._mapping) for row in venue_rows]

    # Generate report
    cell_label = cell["label"] or cell["id"]
    report_text = await generate_report(
        concept_name=concept["name"],
        cell_label=cell_label,
        demand=demand,
        supply=supply,
        gap=gap,
        confidence=confidence,
        venue_count=venue_count,
        taste_tags=taste_tags,
        venues=venues,
    )

    structured_data = {
        "cell_id": req.cell_id,
        "cell_label": cell_label,
        "concept_id": req.concept_id,
        "concept_name": concept["name"],
        "demand": demand,
        "supply": supply,
        "gap": gap,
        "confidence": confidence,
        "venue_count": venue_count,
        "taste_tags": taste_tags[:10],
    }

    return ReportResponse(
        report_text=report_text,
        report=report_text,
        structured_data=structured_data,
    )
