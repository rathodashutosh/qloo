"""Settings router for managing API keys dynamically."""

import os
import re
import logging
import httpx
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional

from config import get_settings
from services.qloo import qloo_client

logger = logging.getLogger(__name__)
router = APIRouter()
settings = get_settings()

ENV_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")


class KeyUpdateRequest(BaseModel):
    qloo_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None
    ee_project_id: Optional[str] = None


class KeyStatusResponse(BaseModel):
    qloo_configured: bool
    qloo_key_preview: Optional[str] = None
    openai_configured: bool
    openai_key_preview: Optional[str] = None
    ee_configured: bool = False
    ee_project: Optional[str] = None
    validation_status: Optional[str] = None


def mask_key(key: str) -> str:
    if not key or len(key) < 6:
        return "Not configured"
    return f"{key[:4]}...{key[-4:]}"


def save_env_file(
    qloo_key: Optional[str] = None,
    openai_key: Optional[str] = None,
    ee_project: Optional[str] = None,
):
    """Write or update keys in .env file."""
    env_content = {}
    if os.path.exists(ENV_PATH):
        try:
            with open(ENV_PATH, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        env_content[k.strip()] = v.strip()
        except Exception as e:
            logger.warning("Could not read existing .env: %s", e)

    if qloo_key is not None:
        env_content["QLOO_API_KEY"] = qloo_key.strip()
    if openai_key is not None:
        env_content["OPENAI_API_KEY"] = openai_key.strip()
    if ee_project is not None:
        env_content["EE_PROJECT_ID"] = ee_project.strip()

    if "DATABASE_URL" not in env_content:
        env_content["DATABASE_URL"] = "sqlite:///./taste_gap.db"

    try:
        with open(ENV_PATH, "w", encoding="utf-8") as f:
            for k, v in env_content.items():
                f.write(f"{k}={v}\n")
        logger.info("Saved updated configuration to %s", ENV_PATH)
    except Exception as e:
        logger.error("Failed to write .env file: %s", e)


async def validate_qloo_key(api_key: str) -> tuple[bool, str]:
    """Test the Qloo API key against hackathon API."""
    if not api_key:
        return False, "Key is empty"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{settings.QLOO_BASE_URL}/search",
                headers={"X-Api-Key": api_key.strip()},
                params={"query": "coffee", "types": "urn:entity:place"},
            )
            if resp.status_code == 200:
                return True, "Key is active and authenticated successfully with Qloo Hackathon API"
            elif resp.status_code in (401, 403):
                return False, f"Qloo API authentication failed (HTTP {resp.status_code}): Invalid or expired key"
            else:
                return False, f"Qloo API returned HTTP {resp.status_code}: {resp.text[:200]}"
    except Exception as exc:
        return False, f"Network connection to Qloo API failed: {str(exc)}"


@router.get("/settings/keys", response_model=KeyStatusResponse)
async def get_key_status():
    """Return status of configured API keys."""
    qloo_active = bool(settings.QLOO_API_KEY and not settings.QLOO_API_KEY.startswith("your-"))
    openai_active = bool(settings.OPENAI_API_KEY and not settings.OPENAI_API_KEY.startswith("your-"))
    ee_project = getattr(settings, "EE_PROJECT_ID", "") or os.environ.get("EE_PROJECT_ID", "")
    ee_active = bool(ee_project)

    return KeyStatusResponse(
        qloo_configured=qloo_active,
        qloo_key_preview=mask_key(settings.QLOO_API_KEY) if qloo_active else None,
        openai_configured=openai_active,
        openai_key_preview=mask_key(settings.OPENAI_API_KEY) if openai_active else None,
        ee_configured=ee_active,
        ee_project=ee_project if ee_active else None,
        validation_status="Configured" if qloo_active else "Qloo API key needed",
    )


@router.post("/settings/keys")
async def update_keys(req: KeyUpdateRequest):
    """Update and validate API keys."""
    validation_message = None
    qloo_valid = True

    if req.qloo_api_key is not None:
        new_key = req.qloo_api_key.strip()
        if new_key:
            qloo_valid, validation_message = await validate_qloo_key(new_key)
        else:
            qloo_valid = True
            validation_message = "Qloo key cleared"
        settings.QLOO_API_KEY = new_key
        qloo_client.api_key = new_key
        if qloo_client._client and not qloo_client._client.is_closed:
            await qloo_client._client.aclose()
        qloo_client._client = None
        save_env_file(qloo_key=new_key)

    if req.openai_api_key is not None and req.openai_api_key.strip():
        settings.OPENAI_API_KEY = req.openai_api_key.strip()
        save_env_file(openai_key=req.openai_api_key.strip())

    if req.ee_project_id is not None:
        ee_proj = req.ee_project_id.strip()
        settings.EE_PROJECT_ID = ee_proj
        os.environ["EE_PROJECT_ID"] = ee_proj
        save_env_file(ee_project=ee_proj)
        from services.gee import init_earth_engine
        init_earth_engine(project_id=ee_proj)

    return {
        "status": "ok" if qloo_valid else "warning",
        "qloo_valid": qloo_valid,
        "message": validation_message or "Keys updated successfully",
        "qloo_configured": bool(settings.QLOO_API_KEY),
        "openai_configured": bool(settings.OPENAI_API_KEY),
        "ee_configured": bool(getattr(settings, "EE_PROJECT_ID", "")),
    }


@router.post("/settings/upload-env")
async def upload_env(file: UploadFile = File(...)):
    """Upload a .env or text file containing API keys."""
    content = await file.read()
    text = content.decode("utf-8", errors="ignore")

    qloo_key = None
    openai_key = None
    ee_project = None

    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "QLOO_API_KEY" in line and "=" in line:
            qloo_key = line.split("=", 1)[1].strip().strip('"').strip("'")
        elif "OPENAI_API_KEY" in line and "=" in line:
            openai_key = line.split("=", 1)[1].strip().strip('"').strip("'")
        elif ("EE_PROJECT_ID" in line or "GCP_PROJECT_ID" in line) and "=" in line:
            ee_project = line.split("=", 1)[1].strip().strip('"').strip("'")

    if qloo_key or openai_key or ee_project:
        save_env_file(qloo_key=qloo_key, openai_key=openai_key, ee_project=ee_project)
        if qloo_key:
            settings.QLOO_API_KEY = qloo_key
            qloo_client.api_key = qloo_key
        if openai_key:
            settings.OPENAI_API_KEY = openai_key
        if ee_project:
            settings.EE_PROJECT_ID = ee_project
            os.environ["EE_PROJECT_ID"] = ee_project
            from services.gee import init_earth_engine
            init_earth_engine(project_id=ee_project)
        elif len(line) > 20 and not "=" in line:
            # Maybe raw key was pasted into a text file
            qloo_key = line.strip()

    if qloo_key or openai_key:
        req = KeyUpdateRequest(qloo_api_key=qloo_key, openai_api_key=openai_key)
        return await update_keys(req)

    raise HTTPException(status_code=400, detail="No valid QLOO_API_KEY found in uploaded file")
