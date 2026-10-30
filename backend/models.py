"""Pydantic models for request/response validation."""

from pydantic import BaseModel, Field
from typing import Optional, Any


# ── Concept ──────────────────────────────────────────────────────────────────

class Concept(BaseModel):
    """A concept (business type) to evaluate across the map."""
    id: str
    name: str
    description: Optional[str] = None
    qloo_tags: list[str]
    osm_filter: str
    saturation: int = 5


# ── Cell ─────────────────────────────────────────────────────────────────────

class Cell(BaseModel):
    """A geographic hex cell on the grid."""
    id: str
    city: str
    lat: float
    lon: float
    radius_km: float
    label: Optional[str] = None
    h3_index: Optional[str] = None


# ── Score ────────────────────────────────────────────────────────────────────

class Score(BaseModel):
    """Demand/supply/gap score for a cell × concept pair."""
    cell_id: str
    concept_id: str
    demand: Optional[float] = None
    supply: Optional[float] = None
    gap: Optional[float] = None
    confidence: Optional[str] = None
    venue_count: Optional[int] = None
    qloo_result_count: Optional[int] = None
    qloo_payload_json: Optional[str] = None
    updated_at: Optional[str] = None


# ── Venue ────────────────────────────────────────────────────────────────────

class Venue(BaseModel):
    """A point-of-interest / venue from OSM or Qloo."""
    osm_id: str
    cell_id: Optional[str] = None
    concept_id: Optional[str] = None
    name: Optional[str] = None
    lat: float
    lon: float
    distance_km: Optional[float] = None
    tags_json: Optional[str] = None


# ── GeoJSON helpers ──────────────────────────────────────────────────────────

class GeoJSONFeatureProperties(BaseModel):
    id: Optional[str] = None
    cell_id: str
    lat: float
    lon: float
    demand: Optional[float] = None
    supply: Optional[float] = None
    gap: Optional[float] = None
    confidence: Optional[str] = None
    label: Optional[str] = None


class GeoJSONFeature(BaseModel):
    type: str = "Feature"
    id: Optional[str] = None
    geometry: dict
    properties: dict


class GeoJSONFeatureCollection(BaseModel):
    type: str = "FeatureCollection"
    features: list[dict]


# ── API request / response models ───────────────────────────────────────────

class CellDetailResponse(BaseModel):
    id: Optional[str] = None
    cell_id: str
    concept_id: str
    label: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    demand: Optional[float] = None
    supply: Optional[float] = None
    gap: Optional[float] = None
    confidence: Optional[str] = None
    taste_tags: list[str] = []
    venues: list[Venue] = []


class ReportRequest(BaseModel):
    cell_id: str
    concept_id: str
    city: Optional[str] = None


class ReportResponse(BaseModel):
    report_text: str = ""
    report: Optional[str] = None  # Frontend convenience alias
    structured_data: Optional[dict] = Field(default_factory=dict)
    cell_id: Optional[str] = None
    concept_id: Optional[str] = None
    city: Optional[str] = None


class LiveQueryRequest(BaseModel):
    lat: float
    lon: float
    concept_id: str
    radius_km: Optional[float] = 1.5


class LiveQueryResponse(BaseModel):
    lat: float
    lon: float
    concept_id: str
    label: Optional[str] = None
    suburb: Optional[str] = None
    city: Optional[str] = None
    demand: Optional[float] = None
    supply: Optional[float] = None
    gap: Optional[float] = None
    confidence: Optional[str] = None
    venue_count: int = 0
    qloo_result_count: int = 0
    venues: list[Venue] = []
    taste_tags: list[str] = []
    landmarks: list[str] = []


class ChatRequest(BaseModel):
    message: str
    context: Optional[dict] = Field(default_factory=dict)
    history: Optional[list[dict]] = Field(default_factory=list)
    cell_id: Optional[str] = None
    concept_id: Optional[str] = None
    city: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    reply: Optional[str] = None
