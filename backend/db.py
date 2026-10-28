"""SQLite database initialization and connection management."""

import databases
import aiosqlite
import logging
from config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

# databases library for async query support
database = databases.Database(settings.DATABASE_URL)

SQL_CREATE_TABLES = """
CREATE TABLE IF NOT EXISTS cells (
    id TEXT PRIMARY KEY,
    city TEXT NOT NULL,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    radius_km REAL NOT NULL,
    label TEXT,
    h3_index TEXT
);

CREATE TABLE IF NOT EXISTS concepts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    qloo_tags TEXT NOT NULL,
    osm_filter TEXT NOT NULL,
    saturation INTEGER NOT NULL DEFAULT 5
);

CREATE TABLE IF NOT EXISTS scores (
    cell_id TEXT NOT NULL,
    concept_id TEXT NOT NULL,
    demand REAL,
    supply REAL,
    gap REAL,
    confidence TEXT,
    venue_count INTEGER,
    qloo_result_count INTEGER,
    qloo_payload_json TEXT,
    updated_at TEXT,
    PRIMARY KEY (cell_id, concept_id),
    FOREIGN KEY (cell_id) REFERENCES cells(id),
    FOREIGN KEY (concept_id) REFERENCES concepts(id)
);

CREATE TABLE IF NOT EXISTS venues (
    osm_id TEXT PRIMARY KEY,
    cell_id TEXT,
    concept_id TEXT,
    name TEXT,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    tags_json TEXT,
    FOREIGN KEY (cell_id) REFERENCES cells(id),
    FOREIGN KEY (concept_id) REFERENCES concepts(id)
);
"""


async def init_db():
    """Initialize the database: create tables if they don't exist."""
    # Extract the file path from the DATABASE_URL
    db_path = settings.DATABASE_URL.replace("sqlite:///", "")
    if db_path.startswith("./"):
        db_path = db_path[2:]

    logger.info("Initializing database at %s", db_path)

    async with aiosqlite.connect(db_path) as conn:
        await conn.executescript(SQL_CREATE_TABLES)
        await conn.commit()

    logger.info("Database tables created successfully.")


async def connect_db():
    """Connect the databases connection pool."""
    await database.connect()
    logger.info("Database connection pool opened.")


async def disconnect_db():
    """Disconnect the databases connection pool."""
    await database.disconnect()
    logger.info("Database connection pool closed.")
