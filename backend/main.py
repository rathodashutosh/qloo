"""FastAPI application entry point for the Taste-Gap Finder backend."""

import json
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from db import init_db, connect_db, disconnect_db, database

# Import routers
from routers.concepts import router as concepts_router
from routers.map import router as map_router
from routers.cell import router as cell_router
from routers.report import router as report_router
from routers.live_query import router as live_query_router
from routers.settings import router as settings_router
from routers.gee import router as gee_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

settings = get_settings()

# ── Seed concepts ────────────────────────────────────────────────────────────

SEED_CONCEPTS = [
    {
        "id": "specialty-coffee",
        "name": "Specialty Coffee",
        "description": "Third-wave and artisan coffee shops",
        "qloo_tags": ["specialty coffee", "third wave coffee", "artisan coffee"],
        "osm_filter": '[\"amenity\"=\"cafe\"][\"cuisine\"~\"coffee\"] or [\"amenity\"=\"cafe\"]',
        "saturation": 8,
    },
    {
        "id": "live-music-venue",
        "name": "Live Music Venue",
        "description": "Venues with live music performances",
        "qloo_tags": ["live music", "jazz club", "music venue"],
        "osm_filter": '[\"amenity\"=\"nightclub\"][\"music\"=\"live\"] or [\"amenity\"=\"pub\"][\"live_music\"=\"yes\"]',
        "saturation": 4,
    },
    {
        "id": "board-game-cafe",
        "name": "Board Game Cafe",
        "description": "Cafes with board games and tabletop gaming",
        "qloo_tags": ["board games", "tabletop gaming", "game cafe"],
        "osm_filter": '[\"amenity\"=\"cafe\"][\"board_games\"=\"yes\"] or [\"leisure\"=\"board_game\"]',
        "saturation": 3,
    },
    {
        "id": "bookstore-cafe",
        "name": "Bookstore Cafe",
        "description": "Bookstores with cafe / book cafes",
        "qloo_tags": ["bookstore", "book cafe", "literary"],
        "osm_filter": '[\"shop\"=\"books\"]',
        "saturation": 4,
    },
    {
        "id": "vegan-restaurant",
        "name": "Vegan Restaurant",
        "description": "Plant-based and vegan dining",
        "qloo_tags": ["vegan", "plant-based", "vegan restaurant"],
        "osm_filter": '[\"amenity\"=\"restaurant\"][\"diet:vegan\"~\"yes|only\"] or [\"cuisine\"~\"vegan\"]',
        "saturation": 5,
    },
    {
        "id": "coworking-cafe",
        "name": "Co-working Cafe",
        "description": "Coworking spaces and remote-work-friendly cafes",
        "qloo_tags": ["coworking", "remote work", "digital nomad"],
        "osm_filter": '[\"amenity\"=\"coworking_space\"] or [\"office\"=\"coworking\"]',
        "saturation": 4,
    },
    {
        "id": "craft-brewery",
        "name": "Craft Brewery",
        "description": "Microbreweries and craft beer taprooms",
        "qloo_tags": ["craft beer", "microbrewery", "brewery taproom"],
        "osm_filter": '[\"craft\"=\"brewery\"] or [\"microbrewery\"=\"yes\"]',
        "saturation": 3,
    },
    {
        "id": "natural-wine-bar",
        "name": "Natural Wine Bar",
        "description": "Natural and organic wine bars",
        "qloo_tags": ["natural wine", "wine bar", "organic wine"],
        "osm_filter": '[\"amenity\"=\"bar\"][\"drink\"~\"wine\"] or [\"amenity\"=\"bar\"]',
        "saturation": 4,
    },
]


async def seed_concepts():
    """Insert seed concepts if the table is empty."""
    count = await database.fetch_val("SELECT COUNT(*) FROM concepts")
    if count and count > 0:
        logger.info("Concepts table already has %d rows, skipping seed.", count)
        return

    logger.info("Seeding %d concepts...", len(SEED_CONCEPTS))
    for c in SEED_CONCEPTS:
        await database.execute(
            """
            INSERT OR IGNORE INTO concepts (id, name, description, qloo_tags, osm_filter, saturation)
            VALUES (:id, :name, :description, :qloo_tags, :osm_filter, :saturation)
            """,
            values={
                "id": c["id"],
                "name": c["name"],
                "description": c["description"],
                "qloo_tags": json.dumps(c["qloo_tags"]),
                "osm_filter": c["osm_filter"],
                "saturation": c["saturation"],
            },
        )
    logger.info("Concepts seeded successfully.")


# ── App lifecycle ────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage startup/shutdown: init DB, seed data, open/close connections."""
    await init_db()
    await connect_db()
    await seed_concepts()
    logger.info("🚀 Taste-Gap Finder backend started on port %d", settings.PORT)
    yield
    await disconnect_db()
    logger.info("👋 Taste-Gap Finder backend shut down.")


# ── FastAPI app ──────────────────────────────────────────────────────────────

app = FastAPI(
    title="Taste-Gap Finder API",
    description="Backend API for discovering market opportunities using Qloo taste intelligence and OSM supply data.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware — allow all origins for dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(concepts_router, prefix="/api", tags=["concepts"])
app.include_router(map_router, prefix="/api", tags=["map"])
app.include_router(cell_router, prefix="/api", tags=["cell"])
app.include_router(report_router, prefix="/api", tags=["report"])
app.include_router(live_query_router, prefix="/api", tags=["live-query"])
app.include_router(settings_router, prefix="/api", tags=["settings"])
app.include_router(gee_router, prefix="/api", tags=["gee"])


# ── Health check ─────────────────────────────────────────────────────────────

@app.get("/api/health", tags=["health"])
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "taste-gap-finder"}
