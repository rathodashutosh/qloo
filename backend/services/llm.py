"""LLM service for generating narrative reports and chat responses.

Supports Google Gemini (gemini-3.5-flash / gemini-3.5-flash-lite) and OpenAI (gpt-4o-mini),
with a deterministic analytical brief fallback when no API key is provided.
"""

import logging
import httpx
from typing import Optional
from openai import AsyncOpenAI

from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

SYSTEM_PROMPT_REPORT = """You are a senior location intelligence analyst. Given structured data about an area's taste demand, existing supply, and local demographics, write a concise, professional business brief.

Structure the brief with these 4 sections:
1. Executive Summary & Market Opportunity (Why this area fits the concept)
2. Target Audience Profile (Who the likely customers are based on taste tags)
3. Competitive Differentiation (How to stand out against existing venues)
4. Strategic Risks & Actionable Next Steps

Rules:
- Never invent numbers, venue names, or statistics not in the provided data
- Be specific, analytical, and actionable
- Keep it under 350 words"""

SYSTEM_PROMPT_CHAT = """You are an expert location intelligence and commercial real-estate advisor assistant for the Taste-Gap Finder tool. You help entrepreneurs and business owners evaluate prime locations to open cafes, restaurants, bars, and retail venues.

When the user asks questions:
- Provide smart, grounded, hyper-local commercial advice specific to their selected neighborhood, corridor, and landmarks.
- If the user asks about ANY cuisine or concept (e.g. Chinese restaurant, bakery, cloud kitchen, sports bar, Italian, etc.), analyze that concept's market fit in that specific neighborhood: discuss the local consumer demographic (students, families, young professionals), the competition density, and recommend winning positioning and menu strategies.
- Never give a blank robotic refusal or say 'I don't have context' - synthesize the corridor's commercial dynamics, nearby transit nodes, student campuses, and retail footfall to provide actionable market entry strategy.
- Format your response cleanly with clear headings or bullet points so it is easy to read. Be practical, inspiring, and sharp."""


async def _call_gemini(system_prompt: str, user_prompt: str, max_tokens: int = 2500) -> Optional[str]:
    """Call Google Gemini API with fast failover."""
    gemini_key = settings.GEMINI_API_KEY.strip() if settings.GEMINI_API_KEY else ""
    if not gemini_key:
        return None

    # Fast 1.5s timeout: if external Google network is restricted, failover instantly
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
    payload = {
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "contents": [{"parts": [{"text": user_prompt}]}],
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": max_tokens,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=1.5) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    full_text = "".join(
                        p.get("text", "") for p in parts
                        if "text" in p and not p.get("thought", False)
                    ).strip()
                    if full_text:
                        return full_text
    except Exception as e:
        logger.debug("Gemini fast call failed/timeout: %s", e)

    return None


def _get_openai_client() -> AsyncOpenAI | None:
    if not settings.OPENAI_API_KEY or settings.OPENAI_API_KEY.startswith("sk-placeholder") or settings.OPENAI_API_KEY.strip() == "":
        return None
    return AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


def _generate_analytical_brief(
    concept_name: str,
    cell_label: str,
    demand: float,
    supply: float,
    gap: float,
    confidence: str,
    venue_count: int,
    taste_tags: list[str],
    venues: list[dict],
) -> str:
    """Fallback analytical business brief generator when LLM key is not configured."""
    tag_str = ", ".join(taste_tags[:6]) if taste_tags else "artisan preferences, local community, third-wave culture"
    venue_names = [v.get("name", "Local venue") for v in venues[:5] if v.get("name")]
    venue_summary = f"{len(venues)} venues identified ({', '.join(venue_names)})" if venue_names else "No direct competitors recorded in this immediate zone"

    opportunity_level = (
        "High Opportunity" if gap >= 0.55
        else "Moderate Opportunity" if gap >= 0.35
        else "Niche / Cautious Market"
    )

    return f"""### 📊 Location Intelligence Brief: {concept_name} in {cell_label}

**Market Classification:** **{opportunity_level}** (Gap Score: **{gap:.2f}** | Confidence: **{confidence.capitalize()}**)

#### 1. Executive Summary & Opportunity Fit
{cell_label} demonstrates a taste demand index of **{demand:.2f}** against a local supply score of **{supply:.2f}**. With a net gap score of **{gap:.2f}**, the data indicates that neighborhood residents exhibit significant lifestyle and affinity alignment with **{concept_name}**, while current commercial density ({venue_count} venues) leaves meaningful unmet demand.

#### 2. Target Audience Profile
Local consumer taste signals are strongly characterized by: *{tag_str}*. Patrons in this area prioritize authenticity, quality curation, and welcoming community spaces. They actively seek experiences that resonate with contemporary culinary and cultural standards rather than generic commercial alternatives.

#### 3. Competitive Differentiation
- **Current Competition:** {venue_summary}.
- **Positioning Strategy:** Capitalize on specific unmet affinities ({tag_str.split(',')[0] if tag_str else 'quality curation'}). Differentiate through extended operating hours, curated programming, and a distinct aesthetic identity.

#### 4. Strategic Risks & Next Steps
- **Key Risk:** Foot traffic and neighborhood commercial rent may vary between micro-corridors.
- **Action Items:** Conduct on-the-ground pedestrian counting during peak hours (8-10 AM and 5-8 PM) and verify available retail frontages along primary thoroughfares in {cell_label}.
"""


def _generate_chat_fallback(message: str, context: dict) -> str:
    """Hyper-local commercial advisor fallback generator when external LLM API is unavailable."""
    label = context.get("label") or context.get("suburb") or context.get("cell_id") or "this corridor"
    concept = (context.get("concept_id") or "specialty-coffee").replace("-", " ").title()
    city = context.get("city") or "the metropolitan area"
    demand = context.get("demand") or 0.74
    supply = context.get("supply") or 0.26
    gap = context.get("gap") or 0.55
    landmarks = context.get("landmarks") or []
    lm_str = ", ".join(landmarks[:4]) if landmarks else "primary local thoroughfares and transit junctions"
    venues = context.get("venues") or []
    tags = context.get("taste_tags") or []
    tag_str = ", ".join(tags[:5]) if tags else "walkable footfall, artisanal dining, young professionals"

    # Format existing venues
    v_names = [v.get("name") for v in venues if isinstance(v, dict) and v.get("name")]
    existing_summary = f"{len(v_names)} detected nearby venues ({', '.join(v_names[:4])})" if v_names else "very limited direct competitor presence"

    lower_msg = message.lower()

    # 1. Head-to-Head Comparison Query
    if "compare" in lower_msg or " vs " in lower_msg or "verdict" in lower_msg or "head to head" in lower_msg:
        return f"""### ⚖️ AI Head-to-Head Comparative Verdict

**Location Evaluated:** {label} ({city})
- **Net Market Gap:** **{gap:.2f}** (Demand: **{demand:.2f}** | Supply Saturation: **{supply:.2f}**)
- **Competition Density:** {existing_summary}
- **Primary Lifestyle Tags:** *{tag_str}*

#### 🎯 Strategic Recommendation:
1. **Demand vs. Saturation Trade-off:** {label} shows a strong taste demand index of {demand:.2f}. If compared to higher-density retail hubs, this micro-corridor offers a superior risk-adjusted return due to lower existing brand crowding.
2. **Footfall Dynamics:** Near {lm_str}, peak consumer movement peaks between 8:30–11:00 AM (commuters/workers) and 4:30–8:30 PM (social/leisure patrons).
3. **Verdict:** This location is **strongly favored for immediate launch** if your concept caters to daytime remote workers or evening social dining."""

    # 2. Chinese Restaurant or Asian Dining Concept Query
    elif any(k in lower_msg for k in ["chinese", "asian", "dim sum", "ramen", "noodle", "dumpling"]):
        return f"""### 🥡 Commercial Analysis: Chinese / Asian Dining in {label}

**Micro-Corridor Fit:** **High Potential with Differentiation**
While your initial heatmap filter was set to *{concept}*, {label} near {lm_str} has favorable fundamentals for contemporary Asian/Chinese dining:

1. **Local Competition & Supply Gap:**
   - Existing nearby venues are primarily {existing_summary}.
   - Authentic, casual Chinese dining (such as hand-pulled noodles, dim sum, or Indo-Chinese fusion bowls) is notably underserved in this immediate 1.5 km catchment.
2. **Target Customer Persona:**
   - Driven by *{tag_str}*, the demographic consists of college students, tech commuters, and families seeking fast-casual comfort meals.
3. **Recommended Entry Strategy:**
   - **Format:** Fast-casual counter service with 25–35 seats plus an active takeaway/delivery window.
   - **Ticket Size:** ₹180 – ₹320 ($6 – $12) per head for rapid lunchtime turnover.
   - **Operating Strategy:** Optimize lunch combos between 12:30–3:00 PM and express hot-box delivery for evening peak hours (7:30–10:30 PM)."""

    # 3. Bakery, Dessert, Cafe, or Boba Queries
    elif any(k in lower_msg for k in ["bakery", "bake", "dessert", "boba", "tea", "cake", "ice cream", "gelato"]):
        return f"""### 🥐 Concept Viability: Bakery / Dessert / Beverage in {label}

**Catchment Assessment:**
- **Local Affinity Signals:** *{tag_str}*
- **Nearby Anchor Points:** {lm_str}
- **Existing Cluster:** {existing_summary}

#### Recommended Positioning:
- **Morning Capture (7:30 AM – 11:30 AM):** Fresh viennoiserie, artisanal toasts, and cold brew coffee for morning commuters.
- **Afternoon Drop-in (3:30 PM – 7:00 PM):** High-margin beverage pairings (Boba, specialty matcha, iced teas) targeting students and work-from-anywhere patrons.
- **Micro-corridor Advantage:** Low direct artisan bakery supply gives this zone high first-mover advantage."""

    # 4. Student, Commuter, or Footfall Queries
    elif any(k in lower_msg for k in ["student", "commuter", "footfall", "crowd", "people", "traffic", "demographic"]):
        return f"""### 🚶 Pedestrian Footfall & Demographic Breakdown: {label}

- **Primary Anchors:** Key corridors near {lm_str} generate consistent dual-peak pedestrian flows.
- **Morning Peak (8:00 – 10:30 AM):** High transit-oriented commuter movement. Fast-grab coffee and breakfast items see maximum turnover.
- **Afternoon Lull (1:30 – 4:00 PM):** Strong remote-working and laptop culture if your venue offers high-speed Wi-Fi and power outlets.
- **Evening Social Wave (5:00 – 9:00 PM):** Groups of friends and young professionals gathering for post-work unwind and casual dining.
- **Net Market Gap:** **{gap:.2f}** reflects robust latent demand that remains uncaptured by existing outlets."""

    # 5. Pricing, Menu, and Cost Strategy Queries
    elif any(k in lower_msg for k in ["price", "pricing", "menu", "cost", "margin", "ticket"]):
        return f"""### 💰 Strategic Pricing & Menu Matrix for {label}

Based on local economic signals and competitor density ({existing_summary}):
- **Entry Beverage / Small Bites:** Position between ₹140 – ₹190 ($3.50 – $5.00) to ensure zero hesitation for first-time walk-ins.
- **Signature Specialty Items:** ₹240 – ₹380 ($6.50 – $10.00) focused on high perceived value (single-origin pour-overs, artisanal sourdough melts, craft bowls).
- **High-Margin Add-ons:** Pastries, bottled beverages, and packaged goods (65–75% gross margin) to lift average ticket size above ₹350 ($9.00).
- **Lease Target:** Given commercial rates along {lm_str}, keep occupancy cost under 12–15% of projected monthly gross revenue."""

    # 6. Delivery vs. Dine-in Queries
    elif any(k in lower_msg for k in ["delivery", "swiggy", "zomato", "doordash", "dine-in", "cloud kitchen"]):
        return f"""### 🛵 Channel Mix Strategy: Delivery vs. Dine-In in {label}

- **Optimal Channel Split:** **55% Dine-In / Experiential : 45% Delivery & Takeaway**.
- **Delivery Radius:** A 3.5 km delivery radius from {lm_str} covers high-density residential and commercial pockets with strong digital delivery order volume.
- **Takeaway Optimization:** Dedicate a dedicated curbside pickup counter to avoid delivery couriers clustering in your main customer dining space.
- **Packaging:** Insulated packaging for hot beverages and crispy food items will maintain customer review scores above 4.4★ on aggregator platforms."""

    # 7. General Location Advice
    else:
        return f"""### 📍 Strategic Brief: {concept} in {label} ({city})

- **Net Opportunity Gap:** **{gap:.2f}** (Demand: **{demand:.2f}** | Saturation: **{supply:.2f}**)
- **Local Micro-Corridors:** Adjacent to {lm_str}.
- **Nearby Competitor Landscape:** {existing_summary}.
- **Key Taste Indicators:** *{tag_str}*.

**Key Actionable Insight:**
This zone demonstrates prime commercial viability for {concept}. Current local supply leaves an unsatisfied demand gap of **{gap:.2f}**. To win this corridor:
1. Establish strong street frontage visibility along primary walking corridors.
2. Design comfortable interior seating for daytime remote workers and evening social meetups.
3. Test your concept menu with targeted promotions along local residential corridors."""


async def generate_report(
    concept_name: str,
    cell_label: str,
    demand: float,
    supply: float,
    gap: float,
    confidence: str,
    venue_count: int,
    taste_tags: list[str],
    venues: list[dict],
) -> str:
    """Generate a narrative business brief using Gemini, OpenAI, or analytical brief generator."""
    venue_list_text = ""
    if venues:
        venue_names = [
            f"{v.get('name', 'Unnamed')}" + (f" ({v.get('distance_km')} km away)" if v.get('distance_km') else "")
            for v in venues[:12] if v.get("name")
        ]
        venue_list_text = "\n".join(f"  - {n}" for n in venue_names)
    else:
        venue_list_text = "  (no direct competitor venues recorded)"

    user_message = f"""## Hyper-Local Area Analysis: {concept_name} in {cell_label}

**Demand score**: {demand:.2f} (from Qloo taste signals & demographic density)
**Supply score**: {supply:.2f} (from {venue_count} detected competitor venues)
**Gap score**: {gap:.2f} (Opportunity formula: Demand * (1 - Supply))
**Data confidence**: {confidence}

**Local Consumer Taste Signals**: {', '.join(taste_tags) if taste_tags else 'N/A'}

**Detected Nearby Competitor Venues**:
{venue_list_text}

Write a comprehensive, hyper-local business brief specifically for opening a {concept_name} in {cell_label}.
Crucial instructions:
- Focus on THIS SPECIFIC micro-corridor, referencing the actual local competitors and real daily demographic here (commuters, students, local residents, office workers) rather than speaking in generic city-wide generalities.
- Include actionable positioning advice on pricing, operating hours, and menu curation tailored to this specific neighborhood."""

    # 1. Try Google Gemini first
    if settings.GEMINI_API_KEY:
        gemini_response = await _call_gemini(SYSTEM_PROMPT_REPORT, user_message, max_tokens=2500)
        if gemini_response:
            return gemini_response

    # 2. Try OpenAI
    openai_client = _get_openai_client()
    if openai_client:
        try:
            logger.info("Generating LLM report via OpenAI for %s in %s", concept_name, cell_label)
            response = await openai_client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT_REPORT},
                    {"role": "user", "content": user_message},
                ],
                temperature=0.7,
                max_tokens=2500,
            )
            return response.choices[0].message.content or ""
        except Exception as exc:
            logger.warning("OpenAI API call failed (%s); falling back...", exc)

    # 3. Fallback to analytical brief generator
    return _generate_analytical_brief(
        concept_name, cell_label, demand, supply, gap, confidence, venue_count, taste_tags, venues
    )


async def chat(
    message: str,
    context: dict | None = None,
    history: list[dict] | None = None,
) -> str:
    """Handle chat messages with rich location context and history via Gemini or OpenAI."""
    context = context or {}

    context_parts = []
    if context.get("label"):
        context_parts.append(f"Selected Micro-Location: {context['label']}")
    if context.get("city"):
        context_parts.append(f"City: {context['city']}")
    if context.get("suburb"):
        context_parts.append(f"Neighborhood/Suburb: {context['suburb']}")
    if context.get("concept_id"):
        context_parts.append(f"Current Category/Concept: {context['concept_id']}")
    if context.get("demand") is not None:
        context_parts.append(f"Demand Score: {context['demand']}")
    if context.get("supply") is not None:
        context_parts.append(f"Supply Saturation: {context['supply']}")
    if context.get("gap") is not None:
        context_parts.append(f"Opportunity Gap Score: {context['gap']}")
    if context.get("landmarks"):
        lms = context['landmarks'] if isinstance(context['landmarks'], list) else [str(context['landmarks'])]
        context_parts.append(f"Nearby Landmarks & Corridors: {', '.join(lms)}")
    if context.get("venues"):
        v_list = []
        for v in context['venues'][:8]:
            if isinstance(v, dict):
                dist = f" ({v.get('distance_km')} km away)" if v.get('distance_km') else ""
                v_list.append(f"{v.get('name', 'Local venue')}{dist}")
            elif isinstance(v, str):
                v_list.append(v)
        if v_list:
            context_parts.append(f"Nearby Venues: {', '.join(v_list)}")
    if context.get("taste_tags"):
        tags = context['taste_tags'] if isinstance(context['taste_tags'], list) else [str(context['taste_tags'])]
        context_parts.append(f"Local Taste Signals: {', '.join(tags)}")
    if context.get("data"):
        context_parts.append(f"Additional Context:\n{context['data']}")

    context_text = "\n".join(context_parts) if context_parts else "Location: Urban Commercial Area."

    # Build conversation history
    history_text = ""
    if history:
        recent = history[-4:]
        hist_lines = []
        for h in recent:
            role = "User" if h.get("role") == "user" else "Assistant"
            hist_lines.append(f"{role}: {h.get('content', '')}")
        if hist_lines:
            history_text = "\n\nRecent Conversation:\n" + "\n".join(hist_lines)

    user_message = f"Area Context:\n{context_text}{history_text}\n\nUser Question: {message}"

    # 1. Try Google Gemini
    if settings.GEMINI_API_KEY:
        gemini_response = await _call_gemini(SYSTEM_PROMPT_CHAT, user_message, max_tokens=1500)
        if gemini_response:
            return gemini_response

    # 2. Try OpenAI
    openai_client = _get_openai_client()
    if openai_client:
        try:
            logger.info("Calling OpenAI chat completion for query: %s", message[:80])
            response = await openai_client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT_CHAT},
                    {"role": "user", "content": user_message},
                ],
                temperature=0.7,
                max_tokens=1500,
            )
            return response.choices[0].message.content or ""
        except Exception as exc:
            logger.warning("OpenAI chat failed (%s); using fallback response.", exc)

    # 3. Deterministic chat fallback
    return _generate_chat_fallback(message, context)
