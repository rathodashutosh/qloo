"""Location intelligence service: multi-source discovery (OSM Nominatim + Qloo API)
combined with Google Gemini hyper-local micro-market profiling.
"""

import json
import math
import httpx
import logging
from typing import Dict, Any, List, Optional

from config import get_settings
from services.qloo import qloo_client
from services.geocoding import reverse_geocode

logger = logging.getLogger(__name__)
settings = get_settings()

CONCEPT_MAP = {
    "specialty-coffee": {
        "name": "Specialty Coffee",
        "search_term": "specialty coffee cafe",
        "osm_term": "cafe",
        "tags": ["specialty coffee", "artisan coffee", "third wave coffee", "espresso", "roastery"],
        "saturation": 8,
    },
    "live-music-venue": {
        "name": "Live Music Venue",
        "search_term": "live music venue jazz club pub",
        "osm_term": "pub bar live music",
        "tags": ["live music", "jazz club", "music venue", "acoustic", "concert hall"],
        "saturation": 4,
    },
    "board-game-cafe": {
        "name": "Board Game Cafe",
        "search_term": "board game cafe tabletop games",
        "osm_term": "cafe game",
        "tags": ["board games", "tabletop gaming", "game cafe", "card games"],
        "saturation": 3,
    },
    "bookstore-cafe": {
        "name": "Bookstore Cafe",
        "search_term": "bookstore cafe book cafe library",
        "osm_term": "bookstore cafe books",
        "tags": ["bookstore", "book cafe", "literary", "reading space"],
        "saturation": 4,
    },
    "vegan-restaurant": {
        "name": "Vegan Restaurant",
        "search_term": "vegan restaurant plant based dining",
        "osm_term": "vegan restaurant",
        "tags": ["vegan", "plant-based", "organic", "healthy dining"],
        "saturation": 5,
    },
    "co-working-cafe": {
        "name": "Co-working Cafe",
        "search_term": "coworking cafe work friendly coffee",
        "osm_term": "coworking cafe",
        "tags": ["coworking", "work friendly", "wifi cafe", "laptop friendly"],
        "saturation": 6,
    },
    "craft-brewery": {
        "name": "Craft Brewery",
        "search_term": "craft brewery brewpub microbrewery",
        "osm_term": "brewery pub",
        "tags": ["craft beer", "microbrewery", "brewpub", "draught beer"],
        "saturation": 4,
    },
    "natural-wine-bar": {
        "name": "Natural Wine Bar",
        "search_term": "wine bar natural wine lounge",
        "osm_term": "wine bar",
        "tags": ["wine bar", "natural wine", "sommelier", "tasting room"],
        "saturation": 4,
    },
    "chinese-restaurant": {
        "name": "Chinese Restaurant",
        "search_term": "chinese restaurant dim sum asian noodles",
        "osm_term": "restaurant chinese",
        "tags": ["chinese", "dim sum", "indo-chinese", "noodles", "asian dining"],
        "saturation": 6,
    },
    "italian-trattoria": {
        "name": "Italian Trattoria",
        "search_term": "italian restaurant pizzeria trattoria pasta",
        "osm_term": "restaurant italian",
        "tags": ["italian", "pizza", "artisan pasta", "woodfired", "trattoria"],
        "saturation": 5,
    },
    "bakery-patisserie": {
        "name": "Bakery & Patisserie",
        "search_term": "bakery patisserie artisan bread pastry cakes",
        "osm_term": "bakery cafe",
        "tags": ["artisan bakery", "sourdough", "patisserie", "french pastry", "croissants"],
        "saturation": 7,
    },
    "sushi-bar": {
        "name": "Sushi & Japanese",
        "search_term": "sushi japanese restaurant ramen omakase",
        "osm_term": "restaurant japanese",
        "tags": ["sushi", "japanese", "sashimi", "omakase", "contemporary asian"],
        "saturation": 4,
    },
    "ramen-shop": {
        "name": "Ramen Shop",
        "search_term": "ramen shop japanese noodles broth",
        "osm_term": "restaurant ramen",
        "tags": ["ramen", "tonkotsu", "japanese noodles", "comfort food"],
        "saturation": 4,
    },
    "boba-bubble-tea": {
        "name": "Boba & Bubble Tea",
        "search_term": "boba bubble tea milk tea tapioca",
        "osm_term": "cafe bubble_tea",
        "tags": ["boba", "bubble tea", "taiwanese", "fruit tea", "youth hangout"],
        "saturation": 6,
    },
    "dessert-gelato": {
        "name": "Artisan Gelato & Desserts",
        "search_term": "gelato dessert ice cream waffles",
        "osm_term": "cafe ice_cream",
        "tags": ["gelato", "artisan ice cream", "dessert bar", "late night sweet"],
        "saturation": 5,
    },
    "mexican-taqueria": {
        "name": "Mexican Taqueria",
        "search_term": "mexican restaurant taqueria tacos margaritas",
        "osm_term": "restaurant mexican",
        "tags": ["tacos", "taqueria", "mexican", "street food", "margaritas"],
        "saturation": 4,
    },
    "cocktail-speakeasy": {
        "name": "Speakeasy Cocktail Bar",
        "search_term": "cocktail bar speakeasy mixology lounge",
        "osm_term": "bar cocktail",
        "tags": ["craft cocktails", "speakeasy", "mixology", "intimate lounge"],
        "saturation": 4,
    },
    "sports-bar": {
        "name": "Sports Bar",
        "search_term": "sports bar pub screens draft beer",
        "osm_term": "pub bar",
        "tags": ["sports bar", "live screening", "draft beer", "pub snacks"],
        "saturation": 4,
    },
    "rooftop-lounge": {
        "name": "Rooftop Lounge",
        "search_term": "rooftop bar lounge scenic view dining",
        "osm_term": "bar rooftop",
        "tags": ["rooftop", "scenic view", "lounge", "evening cocktails"],
        "saturation": 4,
    },
    "burger-diner": {
        "name": "Smash Burger & Craft Shakes",
        "search_term": "gourmet burger diner craft shakes",
        "osm_term": "fast_food burger",
        "tags": ["smash burger", "craft burgers", "shakes", "comfort fast food"],
        "saturation": 5,
    },
    "dim-sum-parlor": {
        "name": "Dim Sum Parlor",
        "search_term": "dim sum dumplings tea house cantonese",
        "osm_term": "restaurant dim_sum",
        "tags": ["dim sum", "dumplings", "cantonese", "bao", "tea house"],
        "saturation": 4,
    },
    "korean-bbq": {
        "name": "Korean BBQ",
        "search_term": "korean bbq korean fried chicken bulgogi",
        "osm_term": "restaurant korean",
        "tags": ["korean bbq", "bulgogi", "korean fried chicken", "table grill"],
        "saturation": 4,
    },
    "pet-cafe": {
        "name": "Cat & Pet Cafe",
        "search_term": "cat cafe pet friendly dog cafe",
        "osm_term": "cafe",
        "tags": ["pet friendly", "cat cafe", "dog cafe", "animal lovers"],
        "saturation": 3,
    },
}

_PROFILE_CACHE: Dict[str, Dict[str, Any]] = {}


# Categories and keywords to strictly exclude from competitor venues
NON_COMPETITOR_KEYWORDS = {
    # Monuments & historical
    "monument", "statue", "memorial", "pillar", "archaeological", "heritage site",
    # Lodging / Accommodations
    "hotel", "inn", "resort", "motel", "lodge", "lodging", "treebo", "oyo", "homestay", "guest house",
    # Beauty, Salons & Clinics
    "salon", "spa", "clinic", "hospital", "dermatolog", "beauty", "hair", "nail", "dental", "pharmacy",
    # Retail / Non-food
    "boutique", "jeweller", "jewelry", "clothing", "saree", "watch", "electronics",
    "hardware", "opticals", "optician", "bank", "atm", "supermarket", "provision",
    "kangan", "fancy store", "stationery", "tailor", "dry clean", "petrol", "fuel",
}

CONCEPT_CATEGORY_MATCHES = {
    "specialty-coffee": {
        "required_any": ["cafe", "coffee", "roaster", "roastery", "bakery", "bake", "espresso", "tea", "bistro", "pastry", "patisserie", "dessert", "thindi", "tiffin"],
    },
    "live-music-venue": {
        "required_any": ["music", "jazz", "pub", "bar", "lounge", "club", "concert", "brewery", "tavern", "acoustic", "band"],
    },
    "board-game-cafe": {
        "required_any": ["game", "board game", "cafe", "coffee", "gaming", "tabletop"],
    },
    "bookstore-cafe": {
        "required_any": ["book", "library", "cafe", "reading", "coffee", "literary"],
    },
    "vegan-restaurant": {
        "required_any": ["vegan", "plant", "organic", "restaurant", "cafe", "salad", "healthy", "dining", "vegetarian"],
    },
    "co-working-cafe": {
        "required_any": ["cowork", "work", "cafe", "coffee", "space", "workspace", "hub"],
    },
    "craft-brewery": {
        "required_any": ["brewery", "brewpub", "beer", "craft beer", "pub", "bar", "alehouse", "taproom"],
    },
    "natural-wine-bar": {
        "required_any": ["wine", "bar", "lounge", "sommelier", "tasting", "bistro", "vineyard"],
    },
    "chinese-restaurant": {
        "required_any": ["chinese", "noodle", "dumpling", "asian", "dim sum", "wok", "schezwan", "chopsticks"],
    },
    "italian-trattoria": {
        "required_any": ["italian", "pizza", "pasta", "trattoria", "pizzeria", "woodfired", "gelato"],
    },
    "bakery-patisserie": {
        "required_any": ["bakery", "bake", "patisserie", "pastry", "cake", "bread", "croissant", "dessert"],
    },
    "sushi-bar": {
        "required_any": ["sushi", "japanese", "ramen", "maki", "bento", "sashimi", "asian"],
    },
    "ramen-shop": {
        "required_any": ["ramen", "noodle", "japanese", "broth", "tonkotsu"],
    },
    "boba-bubble-tea": {
        "required_any": ["boba", "bubble tea", "tea", "milk tea", "tapioca"],
    },
    "dessert-gelato": {
        "required_any": ["gelato", "ice cream", "dessert", "waffle", "sweet", "pastry"],
    },
    "mexican-taqueria": {
        "required_any": ["mexican", "taco", "taqueria", "burrito", "nachos", "margarita"],
    },
    "cocktail-speakeasy": {
        "required_any": ["cocktail", "bar", "speakeasy", "lounge", "spirits", "mixology"],
    },
    "sports-bar": {
        "required_any": ["sports bar", "pub", "bar", "brew", "beer", "draft", "games"],
    },
    "rooftop-lounge": {
        "required_any": ["rooftop", "lounge", "bar", "sky", "view"],
    },
    "burger-diner": {
        "required_any": ["burger", "fries", "diner", "patty", "shakes"],
    },
    "dim-sum-parlor": {
        "required_any": ["dim sum", "dumpling", "bao", "chinese", "tea house"],
    },
    "korean-bbq": {
        "required_any": ["korean", "bbq", "barbecue", "kimchi", "bulgogi", "fried chicken"],
    },
    "pet-cafe": {
        "required_any": ["cat", "dog", "pet", "cafe", "coffee", "puppy"],
    },
}


def is_valid_competitor(name: str, tags: Any, item_type: str, concept_id: str) -> bool:
    """Strictly verify if a venue is a relevant commercial competitor for the selected concept."""
    if not name or len(name.strip()) < 2:
        return False

    name_lower = name.lower()
    tag_list = tags if isinstance(tags, list) else list(tags.values()) if isinstance(tags, dict) else []
    tag_str = " ".join(str(t).lower() for t in tag_list)
    full_text = f"{name_lower} {tag_str} {str(item_type).lower()}"

    # Explicit food/hospitality indicators
    is_explicit_concept = any(w in name_lower for w in ["cafe", "coffee", "roastery", "roasters", "espresso", "bakehouse", "bakery", "restaurant", "bar", "pub", "bistro", "pizzeria", "taqueria", "brewery", "diner"])

    if not is_explicit_concept:
        # Check if name or tags contain any non-competitor keyword
        for bad in NON_COMPETITOR_KEYWORDS:
            if bad in name_lower or bad in tag_str:
                return False

    # Check match against concept keywords
    concept_rules = CONCEPT_CATEGORY_MATCHES.get(concept_id)
    if concept_rules:
        required_keywords = concept_rules["required_any"]
    else:
        # Dynamic custom concept keywords
        words = [w for w in concept_id.lower().replace("-", " ").split() if len(w) > 2]
        required_keywords = words + ["restaurant", "cafe", "dining", "food", "kitchen", "bar"]

    return any(kw in full_text for kw in required_keywords)


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


async def _fetch_osm_venues(lat: float, lon: float, local_name: str, city_name: str, osm_term: str) -> List[Dict[str, Any]]:
    """Query OSM Nominatim for authentic local venues near the specific coordinate/neighborhood."""
    headers = {"User-Agent": "TasteGapFinder/2.0 (Location Analytics; student@hackathon.org)"}
    queries = [
        f"{osm_term} near {local_name} {city_name}",
        f"{osm_term} {local_name}",
        f"{osm_term} near {city_name}",
    ]
    
    venues: List[Dict[str, Any]] = []
    seen = set()

    for q in queries:
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                resp = await client.get(
                    "https://nominatim.openstreetmap.org/search",
                    params={"q": q, "format": "json", "limit": 10},
                    headers=headers,
                )
                if resp.status_code == 200:
                    items = resp.json()
                    for item in items:
                        name = item.get("name") or item.get("display_name", "").split(",")[0].strip()
                        if not name or name in seen or len(name) < 2:
                            continue

                        v_lat = float(item.get("lat", lat))
                        v_lon = float(item.get("lon", lon))
                        dist = haversine_km(lat, lon, v_lat, v_lon)

                        # Filter to reasonable urban radius (within 12 km)
                        if dist <= 12.0:
                            seen.add(name)
                            venues.append({
                                "osm_id": f"osm/{item.get('osm_id', len(venues))}",
                                "name": name,
                                "lat": round(v_lat, 6),
                                "lon": round(v_lon, 6),
                                "distance_km": round(dist, 2),
                                "type": item.get("type", "venue"),
                                "address": item.get("display_name", ""),
                                "tags": {"source": "osm_nominatim", "area": local_name},
                            })
        except Exception as exc:
            logger.debug("OSM venue search failed for query %s: %s", q, exc)

    return venues


async def _fetch_qloo_venues(lat: float, lon: float, local_name: str, city_name: str, concept_name: str) -> List[Dict[str, Any]]:
    """Query Qloo API search for places matching the concept in this area."""
    if not settings.QLOO_API_KEY or settings.QLOO_API_KEY.startswith("your_"):
        return []

    venues = []
    queries = [
        f"{concept_name} {local_name} {city_name}",
        f"{concept_name} {local_name}",
    ]

    for q in queries:
        try:
            res = await qloo_client.search(query=q, types="urn:entity:place")
            if isinstance(res, list):
                for ent in res:
                    if not isinstance(ent, dict):
                        continue
                    name = ent.get("name")
                    if not name:
                        continue
                    loc = ent.get("location") or {}
                    v_lat = float(loc.get("lat")) if loc.get("lat") else None
                    v_lon = float(loc.get("lon")) if loc.get("lon") else None
                    dist = haversine_km(lat, lon, v_lat, v_lon) if (v_lat and v_lon) else 1.2

                    if dist <= 15.0 or not v_lat:
                        venues.append({
                            "osm_id": f"qloo/{ent.get('entity_id', len(venues))}",
                            "name": name,
                            "lat": round(v_lat or (lat + 0.003), 6),
                            "lon": round(v_lon or (lon + 0.003), 6),
                            "distance_km": round(dist, 2),
                            "popularity": ent.get("popularity", 0.75),
                            "tags": [t.get("name") if isinstance(t, dict) else str(t) for t in ent.get("tags", [])],
                        })
        except Exception as e:
            logger.debug("Qloo search failed: %s", e)

    return venues


async def _profile_micro_market_gemini(
    lat: float,
    lon: float,
    concept_name: str,
    local_name: str,
    city_name: str,
    road_name: str,
    known_venues: List[str],
) -> Optional[Dict[str, Any]]:
    """Use Gemini 3.5 Flash / Flash Lite for hyper-local micro-market grounding."""
    gkey = getattr(settings, "GEMINI_API_KEY", "") or ""
    if not gkey:
        return None

    venue_sample = ", ".join(known_venues[:5]) if known_venues else "Local independent outlets"

    prompt = f"""You are a commercial location intelligence AI analyzing an exact site for opening a {concept_name}.
Coordinates: {lat:.5f}, {lon:.5f}
Area: {local_name}, {city_name} (Near: {road_name or 'primary transit/residential corridor'}).
Known nearby venues: {venue_sample}.

Analyze this EXACT micro-neighborhood (pinpointing hyper-local streets, landmarks, and resident/commuter profile, not generic city-level generalities).

Return strictly JSON with:
{{
  "micro_location": "Precise micro-neighborhood, street or transit corridor name",
  "landmarks": ["3-4 exact local landmarks, metro/train stations, campuses, or residential societies"],
  "taste_tags": ["6-8 specific taste signals of patrons in this exact area, e.g. Quick espresso, Commuter fuel, Student hangout, Budget artisanal, Evening social"],
  "competitor_summary": "1-2 sentences on the local competition landscape and gaps",
  "demand": 0.75,
  "supply": 0.25,
  "gap": 0.56,
  "hyperlocal_brief": "A 3-paragraph executive brief analyzing: 1) Why this exact site fits or does not fit, 2) Who the exact daily foot-traffic customers are here, and 3) Strategic positioning recommendations."
}}"""

    models = ["gemini-3.8-flash", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-flash-latest"]
    for m in models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={gkey}"
        try:
            async with httpx.AsyncClient(timeout=3.5) as client:
                resp = await client.post(
                    url,
                    json={
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.2},
                    },
                )
                if resp.status_code == 200:
                    candidates = resp.json().get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        text = "".join(p.get("text", "") for p in parts if "text" in p and not p.get("thought", False))
                        if text:
                            return json.loads(text)
                elif resp.status_code in (404, 503):
                    continue
        except Exception as e:
            logger.debug("Gemini micro-market profiler attempt (%s) failed: %s", m, e)
            continue

    return None


async def analyze_location(
    lat: float,
    lon: float,
    concept_id: str = "specialty-coffee",
    area_label: str = None,
    radius_km: float = 2.0,
) -> Dict[str, Any]:
    """Perform hyper-local location analysis calling OSM, Qloo, and Gemini."""
    cache_key = f"{lat:.4f}_{lon:.4f}_{concept_id}"
    if cache_key in _PROFILE_CACHE:
        return _PROFILE_CACHE[cache_key]

    # 1. Reverse geocode to exact micro-district, road, and city
    geo = await reverse_geocode(lat, lon)
    local_name = geo["suburb"]
    city_name = geo["city"]
    road_name = geo.get("road", "")
    display_label = area_label or geo["label"]

    if concept_id not in CONCEPT_MAP:
        clean_name = concept_id.replace("-", " ").title()
        c_low = concept_id.lower()
        if any(w in c_low for w in ["bar", "pub", "brew", "wine", "cocktail", "lounge"]):
            osm_term = "bar pub"
        elif any(w in c_low for w in ["bakery", "bread", "pastry"]):
            osm_term = "bakery"
        elif any(w in c_low for w in ["restaurant", "dining", "chinese", "italian", "sushi", "ramen", "taco", "mexican", "burger", "pizza", "bbq"]):
            osm_term = "restaurant"
        else:
            osm_term = "cafe restaurant"

        concept_info = {
            "name": clean_name,
            "search_term": f"{clean_name} dining food",
            "osm_term": osm_term,
            "tags": [clean_name, "local dining", "food culture"],
            "saturation": 5,
        }
    else:
        concept_info = CONCEPT_MAP[concept_id]

    concept_name = concept_info["name"]
    saturation = concept_info["saturation"]
    concept_tags = concept_info["tags"]

    # 2. Gather authentic local venues from OSM and Qloo
    osm_venues = await _fetch_osm_venues(lat, lon, local_name, city_name, concept_info["osm_term"])
    qloo_venues = await _fetch_qloo_venues(lat, lon, local_name, city_name, concept_name)

    # Filter and merge venues, avoiding non-competitor entities (monuments, salons, hotels, etc.)
    all_venues = []
    seen_names = set()
    discovered_landmarks = []

    for v in osm_venues + qloo_venues:
        name = v.get("name")
        if not name or name.lower() in seen_names:
            continue
        seen_names.add(name.lower())

        tags = v.get("tags", [])
        v_type = v.get("type", "venue")

        # Check if it is a genuine commercial competitor for this concept
        if is_valid_competitor(name, tags, v_type, concept_id):
            all_venues.append(v)
        else:
            # Non-competitor entities: check if it's a prominent local landmark or monument
            name_low = name.lower()
            tag_low = " ".join(str(t).lower() for t in (tags if isinstance(tags, list) else []))
            if any(w in name_low or w in tag_low for w in ["monument", "pillar", "statue", "memorial", "park", "garden", "temple", "circle", "junction", "heritage", "museum"]):
                if name not in discovered_landmarks and len(discovered_landmarks) < 4:
                    discovered_landmarks.append(name)

    # Sort strictly by distance to clicked point
    all_venues.sort(key=lambda x: x.get("distance_km", 99.0))

    # Extract tags from Qloo results
    taste_tags = []
    for v in qloo_venues:
        for t in v.get("tags", []):
            if t and t not in taste_tags:
                taste_tags.append(t)

    # 3. Call Gemini for Hyper-Local Micro-Market Grounding
    gemini_profile = await _profile_micro_market_gemini(
        lat=lat,
        lon=lon,
        concept_name=concept_name,
        local_name=local_name,
        city_name=city_name,
        road_name=road_name,
        known_venues=[v["name"] for v in all_venues[:6]],
    )

    if gemini_profile:
        # Enrich with Gemini's pinpoint micro-location intelligence
        micro_location = gemini_profile.get("micro_location")
        if micro_location:
            display_label = micro_location

        # Merge taste tags
        for tag in gemini_profile.get("taste_tags", []):
            if tag not in taste_tags:
                taste_tags.append(tag)

        # Merge demand and scores
        gemini_demand = gemini_profile.get("demand")
        gemini_supply = gemini_profile.get("supply")
        gemini_gap = gemini_profile.get("gap")

        venue_count = len(all_venues)
        supply = round(gemini_supply, 2) if gemini_supply is not None else min(1.0, round(venue_count / float(saturation), 3))
        demand = round(gemini_demand, 2) if gemini_demand is not None else 0.75
        gap = round(gemini_gap, 2) if gemini_gap is not None else round(demand * (1.0 - supply), 3)
        confidence = "high" if venue_count >= 4 else "medium"
        brief = gemini_profile.get("hyperlocal_brief")
        landmarks = gemini_profile.get("landmarks", [])
    else:
        # Fallback calculation
        for ct in concept_tags:
            if ct not in taste_tags:
                taste_tags.append(ct)

        venue_count = len(all_venues)
        supply = min(1.0, round(venue_count / float(saturation), 3))
        demand = 0.74 if venue_count > 0 else 0.68
        gap = round(demand * (1.0 - supply), 3)
        confidence = "medium"
        brief = None
        landmarks = []

    # Merge any prominent local landmarks discovered from POI scan (e.g. Ashoka Pillar Monument)
    for dlm in discovered_landmarks:
        if dlm not in landmarks and len(landmarks) < 6:
            landmarks.append(dlm)

    result = {
        "lat": lat,
        "lon": lon,
        "suburb": local_name,
        "city": city_name,
        "label": display_label,
        "concept_id": concept_id,
        "concept_name": concept_name,
        "demand": demand,
        "supply": supply,
        "gap": gap,
        "confidence": confidence,
        "venue_count": len(all_venues),
        "venues": all_venues[:25],
        "taste_tags": taste_tags[:14],
        "landmarks": landmarks,
        "hyperlocal_brief": brief,
    }

    _PROFILE_CACHE[cache_key] = result
    return result
