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
    """Call Google Gemini API using the configured GEMINI_API_KEY."""
    gemini_key = settings.GEMINI_API_KEY.strip() if settings.GEMINI_API_KEY else ""
    if not gemini_key:
        return None

    # Models to try in order of preference (flash-lite is fastest and avoids high-demand spikes)
    candidate_models = ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.8-flash"]

    for model_name in candidate_models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"
        payload = {
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"parts": [{"text": user_prompt}]}],
            "generationConfig": {
                "temperature": 0.7,
                "maxOutputTokens": max_tokens,
            },
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(url, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        # Join all parts to prevent truncation from multi-part generation
                        full_text = "".join(
                            p.get("text", "") for p in parts
                            if "text" in p and not p.get("thought", False)
                        ).strip()
                        if full_text:
                            logger.info("Successfully generated response using Gemini model: %s (length: %d chars)", model_name, len(full_text))
                            return full_text
                elif resp.status_code in (404, 503):
                    logger.warning("Gemini model %s returned %d, trying next candidate...", model_name, resp.status_code)
                    continue
                else:
                    logger.warning("Gemini API call returned status %d: %s", resp.status_code, resp.text[:200])
        except Exception as e:
            logger.warning("Error calling Gemini API (%s): %s", model_name, e)

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
    """Fallback response generator for chat when LLM key is not configured."""
    cell_id = context.get("cell_id", "selected area")
    concept = context.get("concept_id", "this business concept")
    city = context.get("city", "the city")
    data_ctx = context.get("data", "")

    lower_msg = message.lower()
    if "cheap" in lower_msg or "budget" in lower_msg or "rent" in lower_msg:
        return (
            f"When looking for lower-rent opportunities for **{concept}** in **{city}**, "
            "inspect outer-ring grid cells that maintain demand above 0.70 with minimal competitors. "
            "These typically offer 30-50% lower commercial lease rates than core arterial hubs."
        )
    elif "compet" in lower_msg or "venue" in lower_msg:
        return (
            f"In {cell_id}, our supply analysis scans OpenStreetMap for registered venues matching {concept}. "
            f"Current data context: {data_ctx}. High supply reduces the gap score, so look for cells with a high Demand bar and a low Supply bar."
        )
    elif "best" in lower_msg or "recommend" in lower_msg:
        return (
            f"To find the highest-ranking area for **{concept}**, look for green-shaded hexagons on the heatmap. "
            "These represent high taste demand multiplied by low competitor density. Cells with 'High' confidence provide the most statistically robust recommendation."
        )
    else:
        return (
            f"Based on the taste data for {cell_id} ({concept} in {city}):\n\n"
            f"- **Context:** {data_ctx or 'Area selected'}\n"
            "- **Tip:** Click across neighboring cells to compare how affinity and venue saturation shift across district boundaries. You can also toggle 'Compare Mode' at the top to evaluate two zones side-by-side!"
        )


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
