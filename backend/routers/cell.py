"""Cell router — detailed cell breakdown."""

import json
import logging
from typing import Optional

from fastapi import APIRouter, Path, Query
from db import database
from models import CellDetailResponse, Venue

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/cell/{cell_id}", response_model=CellDetailResponse)
async def get_cell_detail(
    cell_id: str = Path(..., description="Cell ID"),
    concept: Optional[str] = Query(None, description="Concept ID"),
    concept_id: Optional[str] = Query(None, description="Concept ID alias"),
):
    """
    Return detailed breakdown for a specific cell × concept:
    demand, supply, gap, confidence, taste tags, and nearby venues.
    """
    active_concept = concept or concept_id or "specialty-coffee"

    # Fetch cell info
    cell_row = await database.fetch_one(
        "SELECT id, lat, lon, label FROM cells WHERE id = :cell_id",
        values={"cell_id": cell_id},
    )

    label = cell_row["label"] if cell_row else cell_id
    lat = cell_row["lat"] if cell_row else None
    lon = cell_row["lon"] if cell_row else None

    # Fetch score
    score_row = await database.fetch_one(
        """
        SELECT demand, supply, gap, confidence, qloo_payload_json
        FROM scores
        WHERE cell_id = :cell_id AND concept_id = :concept_id
        """,
        values={"cell_id": cell_id, "concept_id": active_concept},
    )

    demand = None
    supply = None
    gap = None
    confidence = None
    taste_tags: list[str] = []

    if score_row:
        demand = score_row["demand"]
        supply = score_row["supply"]
        gap = score_row["gap"]
        confidence = score_row["confidence"]

        # Extract taste tags from qloo payload
        if score_row["qloo_payload_json"]:
            try:
                payload = json.loads(score_row["qloo_payload_json"])
                results = payload.get("results", [])
                for result in results:
                    tags = result.get("tags", [])
                    for tag in tags:
                        tag_name = tag.get("name", "") if isinstance(tag, dict) else str(tag)
                        if tag_name and tag_name not in taste_tags:
                            taste_tags.append(tag_name)
                # Also check for explainability / query tags
                if not taste_tags and payload.get("tags"):
                    taste_tags = [t if isinstance(t, str) else t.get("name", "") for t in payload.get("tags", [])]
            except (json.JSONDecodeError, TypeError):
                pass

    # If no taste tags found in score, get default concept tags
    if not taste_tags:
        concept_row = await database.fetch_one(
            "SELECT qloo_tags FROM concepts WHERE id = :id",
            values={"id": active_concept},
        )
        if concept_row and concept_row["qloo_tags"]:
            try:
                taste_tags = json.loads(concept_row["qloo_tags"])
            except Exception:
                pass

    # Fetch venues
    venue_rows = await database.fetch_all(
        """
        SELECT osm_id, name, lat, lon, tags_json
        FROM venues
        WHERE cell_id = :cell_id AND concept_id = :concept_id
        """,
        values={"cell_id": cell_id, "concept_id": active_concept},
    )

    venues = [
        Venue(
            osm_id=v["osm_id"],
            cell_id=cell_id,
            concept_id=active_concept,
            name=v["name"] or "Local Venue",
            lat=v["lat"],
            lon=v["lon"],
            tags_json=v["tags_json"],
        )
        for v in venue_rows
    ]

    return CellDetailResponse(
        id=cell_id,
        cell_id=cell_id,
        concept_id=active_concept,
        label=label,
        lat=lat,
        lon=lon,
        demand=demand if demand is not None else 0.5,
        supply=supply if supply is not None else 0.5,
        gap=gap if gap is not None else 0.25,
        confidence=confidence or "medium",
        taste_tags=taste_tags[:15],
        venues=venues,
    )
