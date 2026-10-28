"""Google Earth Engine (GEE) integration service for Taste-Gap Finder.

Provides Earth Observation imagery (Copernicus Sentinel-1 SAR, Sentinel-2 Optical, VIIRS Night Lights)
to visualize urban density, infrastructure, and commercial activity beneath taste gap hexagons.
"""

import os
import json
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

# Global state
_ee_initialized = False
_active_project = None
_init_error = None

try:
    import ee
    HAS_EE = True
except ImportError:
    ee = None
    HAS_EE = False


def init_earth_engine(
    project_id: Optional[str] = None,
    service_account_email: Optional[str] = None,
    service_account_key: Optional[str] = None,
) -> Dict[str, Any]:
    """Initialize Google Earth Engine with either:
    1. Service Account JSON / dict
    2. GCP Project ID (if user already authenticated via earthengine authenticate or ADC)
    3. Environment variables (EE_PROJECT_ID, GOOGLE_APPLICATION_CREDENTIALS)
    """
    global _ee_initialized, _active_project, _init_error

    if not HAS_EE:
        _init_error = "earthengine-api is not installed in the python environment."
        return {"success": False, "error": _init_error}

    # Resolve project ID
    proj = project_id or os.environ.get("EE_PROJECT_ID") or os.environ.get("GCP_PROJECT_ID")

    # Check for service account credentials
    creds = None
    if service_account_key and service_account_email:
        try:
            if isinstance(service_account_key, str) and service_account_key.strip().startswith("{"):
                key_dict = json.loads(service_account_key)
                creds = ee.ServiceAccountCredentials(service_account_email, key_data=key_dict)
            elif os.path.exists(service_account_key):
                creds = ee.ServiceAccountCredentials(service_account_email, key_file=service_account_key)
        except Exception as e:
            logger.error("Failed to parse GEE service account credentials: %s", e)
            _init_error = f"Invalid service account key: {str(e)}"
            return {"success": False, "error": _init_error}

    # Check for GOOGLE_APPLICATION_CREDENTIALS
    sa_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if not creds and sa_path and os.path.exists(sa_path):
        try:
            with open(sa_path, "r", encoding="utf-8") as f:
                sa_data = json.load(f)
                email = sa_data.get("client_email")
                if email:
                    creds = ee.ServiceAccountCredentials(email, key_file=sa_path)
                    if not proj:
                        proj = sa_data.get("project_id")
        except Exception as e:
            logger.warning("Could not load GOOGLE_APPLICATION_CREDENTIALS: %s", e)

    try:
        if creds:
            if proj:
                ee.Initialize(credentials=creds, project=proj)
            else:
                ee.Initialize(credentials=creds)
        elif proj:
            ee.Initialize(project=proj)
        else:
            ee.Initialize()

        _ee_initialized = True
        _active_project = proj or "default"
        _init_error = None
        logger.info("Google Earth Engine initialized successfully (project=%s)", _active_project)
        return {
            "success": True,
            "project": _active_project,
            "message": "Earth Engine initialized successfully",
        }
    except Exception as exc:
        _ee_initialized = False
        _init_error = str(exc)
        logger.warning("Earth Engine initialization failed: %s", exc)
        return {
            "success": False,
            "project": proj,
            "error": _init_error,
        }


def get_ee_status() -> Dict[str, Any]:
    """Return Earth Engine connection status, available datasets, and config instructions."""
    global _ee_initialized, _active_project, _init_error

    # Try automatic initialization once if not already initialized
    if not _ee_initialized and HAS_EE:
        init_earth_engine()

    return {
        "installed": HAS_EE,
        "initialized": _ee_initialized,
        "project": _active_project,
        "error": _init_error,
        "supported_layers": [
            {
                "id": "sentinel1",
                "name": "Copernicus Sentinel-1 (SAR / Radar)",
                "collection": "COPERNICUS/S1_GRD",
                "description": "Synthetic Aperture Radar backscatter. Highlights dense commercial buildings, concrete infrastructure, and urban density day/night through clouds.",
                "color_palette": "Deep radar grayscale / high backscatter",
            },
            {
                "id": "sentinel2",
                "name": "Copernicus Sentinel-2 (High-Res Optical)",
                "collection": "COPERNICUS/S2_SR_HARMONIZED",
                "description": "10-meter optical multispectral imagery with cloud masking, showing street layouts, retail strips, and vegetation.",
                "color_palette": "True color (RGB)",
            },
            {
                "id": "nightlights",
                "name": "Earth at Night (VIIRS Nighttime Lights)",
                "collection": "NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG",
                "description": "Nocturnal luminosity directly correlated with commercial foot traffic, nightlife vitality, and economic activity.",
                "color_palette": "Black to intense gold/amber radiance",
            },
        ],
        "satellite_basemap_fallback": {
            "id": "satellite",
            "name": "High-Resolution Satellite (ESRI World Imagery)",
            "url": "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            "attribution": "Esri, Maxar, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN",
        },
    }


def get_layer_tile_url(layer_id: str = "sentinel1") -> Dict[str, Any]:
    """Generate an XYZ raster tile URL template from Earth Engine for MapLibre GL.
    
    Returns:
        Dict with 'tile_url' (https://earthengine.googleapis.com/.../tiles/{z}/{x}/{y}),
        vis_params, layer info, or fallback.
    """
    if not _ee_initialized or not HAS_EE:
        # Return fallback high-res satellite
        return {
            "layer_id": layer_id,
            "is_gee_live": False,
            "tile_url": "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            "attribution": "Esri, Maxar, Earthstar Geographics (Satellite fallback - connect GEE for live Copernicus radar/multispectral)",
            "message": _init_error or "Earth Engine not initialized. Connect your GCP Project to activate live Copernicus Sentinel-1.",
        }

    try:
        if layer_id == "sentinel1":
            # Copernicus Sentinel-1 SAR GRD
            # As requested in the user prompt: ee.ImageCollection('COPERNICUS/S1_GRD')
            s1 = (
                ee.ImageCollection("COPERNICUS/S1_GRD")
                .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV"))
                .filter(ee.Filter.eq("instrumentMode", "IW"))
                .select("VV")
                .mean()
            )
            vis = {"min": -25, "max": 0, "palette": ["000b1e", "0f3854", "1d70b8", "f46d43", "fee08b", "ffffff"]}
            map_dict = s1.getMapId(vis)
            tile_url = map_dict["tile_fetcher"].url_format
            return {
                "layer_id": "sentinel1",
                "is_gee_live": True,
                "tile_url": tile_url,
                "name": "Copernicus Sentinel-1 (Radar SAR)",
                "attribution": "Google Earth Engine | Copernicus Sentinel-1 GRD (ESA)",
            }

        elif layer_id == "sentinel2":
            # Copernicus Sentinel-2 True Color
            s2 = (
                ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
                .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
                .median()
                .select(["B4", "B3", "B2"])
            )
            vis = {"min": 0, "max": 3000, "gamma": 1.4}
            map_dict = s2.getMapId(vis)
            tile_url = map_dict["tile_fetcher"].url_format
            return {
                "layer_id": "sentinel2",
                "is_gee_live": True,
                "tile_url": tile_url,
                "name": "Copernicus Sentinel-2 (Optical Multispectral)",
                "attribution": "Google Earth Engine | Copernicus Sentinel-2 (ESA)",
            }

        elif layer_id == "nightlights":
            # VIIRS Nighttime Lights
            viirs = (
                ee.ImageCollection("NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG")
                .select("avg_rad")
                .mean()
            )
            vis = {"min": 0, "max": 60, "palette": ["000000", "1a1a3a", "6a1b9a", "d81b60", "ffb300", "ffffff"]}
            map_dict = viirs.getMapId(vis)
            tile_url = map_dict["tile_fetcher"].url_format
            return {
                "layer_id": "nightlights",
                "is_gee_live": True,
                "tile_url": tile_url,
                "name": "VIIRS Nighttime Lights (Foot Traffic / Vibrancy)",
                "attribution": "Google Earth Engine | NOAA VIIRS Nighttime Lights",
            }

        else:
            raise ValueError(f"Unknown GEE layer: {layer_id}")

    except Exception as exc:
        logger.error("Failed to generate Earth Engine tile URL: %s", exc)
        return {
            "layer_id": layer_id,
            "is_gee_live": False,
            "error": str(exc),
            "tile_url": "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            "attribution": "Esri World Imagery (Satellite Fallback)",
        }
