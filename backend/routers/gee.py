"""Earth Engine router for managing GEE authentication and satellite/radar tile layers."""

import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, UploadFile, File
from pydantic import BaseModel

from services.gee import (
    init_earth_engine,
    get_ee_status,
    get_layer_tile_url,
    HAS_EE,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/gee", tags=["Google Earth Engine"])


class GEEInitRequest(BaseModel):
    project_id: Optional[str] = None
    service_account_email: Optional[str] = None
    service_account_key: Optional[str] = None


@router.get("/status")
def status():
    """Return Earth Engine connection status, available datasets, and configuration."""
    return get_ee_status()


@router.get("/tile-url")
def tile_url(layer: str = Query("sentinel1", description="Layer ID: sentinel1, sentinel2, nightlights")):
    """Get XYZ raster tile URL template for the requested Earth Engine layer."""
    return get_layer_tile_url(layer)


@router.post("/init")
def initialize(req: GEEInitRequest):
    """Initialize Earth Engine with GCP Project ID or Service Account."""
    result = init_earth_engine(
        project_id=req.project_id,
        service_account_email=req.service_account_email,
        service_account_key=req.service_account_key,
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


@router.post("/upload-service-account")
async def upload_service_account(file: UploadFile = File(...)):
    """Upload a Google Cloud service account JSON key for Earth Engine authentication."""
    try:
        content = await file.read()
        import json
        key_data = json.loads(content.decode("utf-8"))
        email = key_data.get("client_email")
        project_id = key_data.get("project_id")

        if not email:
            raise HTTPException(status_code=400, detail="Invalid service account JSON: missing client_email")

        result = init_earth_engine(
            project_id=project_id,
            service_account_email=email,
            service_account_key=json.dumps(key_data),
        )
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error"))
        return {
            "success": True,
            "project": project_id,
            "client_email": email,
            "message": "Service account authenticated and Earth Engine initialized successfully!",
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to process service account file: {str(e)}")


@router.get("/verify-sentinel1")
def verify_sentinel1():
    """Execute the exact verification code from the hackathon guide:
    ee.ImageCollection('COPERNICUS/S1_GRD').first().getInfo()
    """
    if not HAS_EE:
        raise HTTPException(status_code=500, detail="earthengine-api not installed")
    
    import ee
    try:
        first_img = ee.ImageCollection("COPERNICUS/S1_GRD").first().getInfo()
        return {
            "success": True,
            "collection": "COPERNICUS/S1_GRD",
            "image_id": first_img.get("id"),
            "properties": {
                "instrumentMode": first_img.get("properties", {}).get("instrumentMode"),
                "platform_number": first_img.get("properties", {}).get("platform_number"),
                "polarization": first_img.get("properties", {}).get("transmitterReceiverPolarisation"),
                "spacecraft_name": first_img.get("properties", {}).get("spacecraft_name"),
            },
            "bands": [b.get("id") for b in first_img.get("bands", [])],
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Earth Engine verification failed: {str(exc)}")
