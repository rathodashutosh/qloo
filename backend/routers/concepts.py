"""Concepts router — CRUD for concept definitions."""

import json
import logging

from fastapi import APIRouter
from db import database
from models import Concept

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/concepts", response_model=list[Concept])
async def list_concepts():
    """Return all concepts from the database."""
    rows = await database.fetch_all("SELECT * FROM concepts")
    results = []
    for row in rows:
        results.append(
            Concept(
                id=row["id"],
                name=row["name"],
                description=row["description"],
                qloo_tags=json.loads(row["qloo_tags"]),
                osm_filter=row["osm_filter"],
                saturation=row["saturation"],
            )
        )
    return results
