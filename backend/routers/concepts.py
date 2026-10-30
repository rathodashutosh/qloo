"""Concepts router — CRUD for concept definitions."""

import json
import re
import logging
from typing import Optional
from pydantic import BaseModel

from fastapi import APIRouter, Query, HTTPException
from db import database
from models import Concept

logger = logging.getLogger(__name__)
router = APIRouter()


class ConceptCreate(BaseModel):
    name: str
    description: Optional[str] = None
    qloo_tags: Optional[list[str]] = None
    osm_filter: Optional[str] = None
    saturation: Optional[int] = 5


@router.get("/concepts", response_model=list[Concept])
async def list_concepts(query: Optional[str] = Query(None, description="Search term for concepts")):
    """Return all concepts from the database, optionally filtered by keyword."""
    if query and query.strip():
        sql = """
        SELECT * FROM concepts 
        WHERE LOWER(name) LIKE LOWER(:q) 
           OR LOWER(description) LIKE LOWER(:q)
           OR LOWER(qloo_tags) LIKE LOWER(:q)
        """
        rows = await database.fetch_all(sql, values={"q": f"%{query.strip()}%"})
    else:
        rows = await database.fetch_all("SELECT * FROM concepts")

    results = []
    for row in rows:
        tags = []
        raw_tags = row["qloo_tags"]
        if isinstance(raw_tags, str):
            try:
                tags = json.loads(raw_tags)
            except Exception:
                tags = [raw_tags]
        elif isinstance(raw_tags, list):
            tags = raw_tags

        results.append(
            Concept(
                id=row["id"],
                name=row["name"],
                description=row["description"],
                qloo_tags=tags,
                osm_filter=row["osm_filter"] or '["amenity"="cafe"]',
                saturation=row["saturation"] or 5,
            )
        )
    return results


@router.post("/concepts", response_model=Concept)
async def create_concept(req: ConceptCreate):
    """Create a new custom business concept dynamically."""
    name = req.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Concept name cannot be empty")

    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    if not slug:
        slug = f"concept-{int(hash(name)) % 10000}"

    # Check if exists
    existing = await database.fetch_one("SELECT * FROM concepts WHERE id = :id", values={"id": slug})
    if existing:
        tags = []
        raw_tags = existing["qloo_tags"]
        if isinstance(raw_tags, str):
            try:
                tags = json.loads(raw_tags)
            except Exception:
                tags = [raw_tags]
        elif isinstance(raw_tags, list):
            tags = raw_tags
        return Concept(
            id=existing["id"],
            name=existing["name"],
            description=existing["description"],
            qloo_tags=tags,
            osm_filter=existing["osm_filter"] or '["amenity"="cafe"]',
            saturation=existing["saturation"] or 5,
        )

    # Generate smart tags based on the custom name
    base_tag = name.lower()
    tags = req.qloo_tags or [
        base_tag,
        f"{base_tag} cafe",
        f"artisan {base_tag}",
        "specialty",
    ]
    osm_filter = req.osm_filter or f'["amenity"~"cafe|restaurant|bar|fast_food|shop"]["cuisine"~"{base_tag}"] or ["amenity"="cafe"]'
    description = req.description or f"Custom concept: {name}"
    saturation = req.saturation or 5

    await database.execute(
        """
        INSERT INTO concepts (id, name, description, qloo_tags, osm_filter, saturation)
        VALUES (:id, :name, :description, :qloo_tags, :osm_filter, :saturation)
        """,
        values={
            "id": slug,
            "name": name,
            "description": description,
            "qloo_tags": json.dumps(tags),
            "osm_filter": osm_filter,
            "saturation": saturation,
        },
    )

    return Concept(
        id=slug,
        name=name,
        description=description,
        qloo_tags=tags,
        osm_filter=osm_filter,
        saturation=saturation,
    )
