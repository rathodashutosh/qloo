"""Reverse geocoding service using OSM Nominatim with hyper-local granularity and in-memory caching."""

import httpx
import logging
from typing import Dict, Tuple

logger = logging.getLogger(__name__)

# Cache reverse geocode lookups
_GEOCODE_CACHE: Dict[Tuple[float, float], Dict[str, str]] = {}

KNOWN_AREAS = [
    # Bengaluru
    (12.9784, 77.6408, "Indiranagar", "Bengaluru"),
    (12.9352, 77.6245, "Koramangala", "Bengaluru"),
    (12.9716, 77.5946, "MG Road / CBD", "Bengaluru"),
    (12.9783, 77.5726, "Malleshwaram", "Bengaluru"),
    (12.9141, 77.6369, "HSR Layout", "Bengaluru"),
    (12.9250, 77.5938, "Jayanagar", "Bengaluru"),
    (12.9698, 77.7500, "Whitefield", "Bengaluru"),
    # Mumbai
    (19.0596, 72.8295, "Bandra West", "Mumbai"),
    (18.9220, 72.8347, "Colaba", "Mumbai"),
    (19.0178, 72.8478, "Dadar", "Mumbai"),
    (19.1136, 72.8697, "Andheri East", "Mumbai"),
    (19.1363, 72.8277, "Andheri West / Lokhandwala", "Mumbai"),
    (18.9930, 72.8258, "Lower Parel", "Mumbai"),
    (19.0760, 72.8777, "BKC Bandra Kurla Complex", "Mumbai"),
    (18.9880, 73.0930, "New Panvel / Taloja", "Navi Mumbai"),
    # Delhi NCR
    (28.6315, 77.2167, "Connaught Place", "Delhi NCR"),
    (28.5494, 77.2001, "Hauz Khas", "Delhi NCR"),
    (28.5244, 77.2066, "Saket", "Delhi NCR"),
    (28.5892, 77.2270, "Khan Market", "Delhi NCR"),
    (28.4595, 77.0266, "Cyber Hub Gurgaon", "Delhi NCR"),
    # New York
    (40.7233, -74.0030, "SoHo", "New York"),
    (40.7163, -73.9626, "Williamsburg", "New York"),
    (40.7308, -73.9973, "Greenwich Village", "New York"),
    (40.7465, -74.0014, "Chelsea", "New York"),
    (40.7180, -73.9890, "Lower East Side", "New York"),
]


async def reverse_geocode(lat: float, lon: float) -> Dict[str, str]:
    """Reverse geocode coordinates to get suburb, district, road, and city name with maximum precision."""
    cache_key = (round(lat, 4), round(lon, 4))
    if cache_key in _GEOCODE_CACHE:
        return _GEOCODE_CACHE[cache_key]

    try:
        url = "https://nominatim.openstreetmap.org/reverse"
        headers = {
            "User-Agent": "TasteGapFinder/2.0 (Location Analytics; student@hackathon.org)"
        }
        params = {
            "lat": lat,
            "lon": lon,
            "format": "json",
            "zoom": 16,
            "addressdetails": 1,
        }
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(url, headers=headers, params=params)
            if resp.status_code == 200:
                addr = resp.json().get("address", {})

                neighbourhood = addr.get("neighbourhood") or addr.get("junction")
                suburb = addr.get("suburb") or addr.get("quarter") or addr.get("village")
                road = addr.get("road")
                city = (
                    addr.get("city")
                    or addr.get("town")
                    or addr.get("municipality")
                    or addr.get("state_district")
                    or addr.get("county")
                    or "Metro Area"
                )
                state = addr.get("state") or ""

                # Build a precise micro-location label
                local_micro = neighbourhood or suburb or road or addr.get("county") or "Local District"
                
                parts = []
                if neighbourhood:
                    parts.append(neighbourhood)
                elif suburb:
                    parts.append(suburb)
                elif road:
                    parts.append(road)

                if city and city not in parts:
                    parts.append(city)

                label = ", ".join(parts) if parts else f"{local_micro}, {city}"

                result = {
                    "suburb": local_micro,
                    "neighbourhood": neighbourhood or "",
                    "road": road or "",
                    "city": city,
                    "state": state,
                    "label": label,
                }
                _GEOCODE_CACHE[cache_key] = result
                return result
    except Exception as exc:
        logger.debug("Nominatim reverse geocode lookup failed: %s", exc)

    # Fallback to closest known area
    import math
    best_dist = float("inf")
    best_match = ("Local District", "Metro")

    for k_lat, k_lon, k_suburb, k_city in KNOWN_AREAS:
        d = math.hypot(lat - k_lat, lon - k_lon)
        if d < best_dist:
            best_dist = d
            best_match = (k_suburb, k_city)

    result = {
        "suburb": best_match[0],
        "neighbourhood": best_match[0],
        "road": "",
        "city": best_match[1],
        "state": "",
        "label": f"{best_match[0]}, {best_match[1]}",
    }
    _GEOCODE_CACHE[cache_key] = result
    return result
