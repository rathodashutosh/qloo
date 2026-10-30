"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings
from functools import lru_cache


import os
from pydantic_settings import BaseSettings
from functools import lru_cache

ENV_FILE = os.path.join(os.path.dirname(__file__), ".env")


class Settings(BaseSettings):
    """Application settings from .env file."""

    QLOO_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    DATABASE_URL: str = "sqlite:///./taste_gap.db"

    # Qloo API
    QLOO_BASE_URL: str = "https://hackathon.api.qloo.com"
    QLOO_MAX_RETRIES: int = 3
    QLOO_RATE_LIMIT: float = 2.0  # max requests per second

    # Overpass API
    OVERPASS_URL: str = "https://overpass-api.de/api/interpreter"

    # H3 grid
    H3_RESOLUTION: int = 7  # avg edge ~1.2km

    # AI / LLM
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    OPENAI_MODEL: str = "gpt-4o-mini"

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    model_config = {"env_file": ENV_FILE, "env_file_encoding": "utf-8"}


@lru_cache()
def get_settings() -> Settings:
    """Return cached settings singleton."""
    return Settings()
