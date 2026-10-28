"""LLM service for generating narrative reports and chat responses."""

import logging
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

SYSTEM_PROMPT_CHAT = """You are a location intelligence analyst assistant for the Taste-Gap Finder tool. You help entrepreneurs and real-estate advisors find prime locations to open cafes, bars, and venues.
You analyze demand scores (0-1 from Qloo taste data), supply saturation (0-1 from OpenStreetMap), and gap scores (Demand × [1 - Supply]).

Rules:
- Only reference data that has been provided in the context
- Never invent numbers or venue names
- Be concise, professional, and practical
- If the user asks for suggestions or comparisons, highlight high-gap areas with low competition"""


def _get_client() -> AsyncOpenAI | None:
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
            "outer ring cells (such as Bushwick, Crown Heights, or Sunnyside) typically offer "
            "30-50% lower commercial lease rates than core Manhattan hubs (SoHo/Chelsea), while still maintaining strong demand scores. "
            "Inspect cells with gap scores above 0.50 outside the downtown corridor for optimal capital efficiency."
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
    """Generate a narrative business brief using LLM or structured fallback."""
    client = _get_client()
    if client is None:
        logger.info("OpenAI API key not configured, using structured analytical brief generator.")
        return _generate_analytical_brief(
            concept_name, cell_label, demand, supply, gap, confidence, venue_count, taste_tags, venues
        )

    venue_list_text = ""
    if venues:
        venue_names = [v.get("name", "Unnamed") for v in venues[:12] if v.get("name")]
        venue_list_text = "\n".join(f"  - {n}" for n in venue_names)
    else:
        venue_list_text = "  (no direct competitor venues recorded)"

    user_message = f"""## Area Analysis: {concept_name} in {cell_label}

**Demand score**: {demand:.2f} (normalized 0-1 from Qloo taste data)
**Supply score**: {supply:.2f} (normalized 0-1, from {venue_count} existing venues)
**Gap score**: {gap:.2f} (Opportunity formula: Demand * (1 - Supply))
**Data confidence**: {confidence}

**Top taste tags in this area**: {', '.join(taste_tags) if taste_tags else 'N/A'}

**Existing competitor venues**:
{venue_list_text}

Write a comprehensive business brief for opening a {concept_name} in {cell_label}."""

    try:
        logger.info("Generating LLM report via OpenAI for %s in %s", concept_name, cell_label)
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT_REPORT},
                {"role": "user", "content": user_message},
            ],
            temperature=0.7,
            max_tokens=650,
        )
        return response.choices[0].message.content or ""
    except Exception as exc:
        logger.warning("OpenAI API call failed (%s); falling back to analytical brief generator.", exc)
        return _generate_analytical_brief(
            concept_name, cell_label, demand, supply, gap, confidence, venue_count, taste_tags, venues
        )


async def chat(
    message: str,
    context: dict | None = None,
) -> str:
    """Handle chat messages with optional data context."""
    context = context or {}
    client = _get_client()

    if client is None:
        return _generate_chat_fallback(message, context)

    context_parts = []
    if context.get("city"):
        context_parts.append(f"City: {context['city']}")
    if context.get("concept_id"):
        context_parts.append(f"Current concept: {context['concept_id']}")
    if context.get("cell_id"):
        context_parts.append(f"Current cell: {context['cell_id']}")
    if context.get("data"):
        context_parts.append(f"Data context:\n{context['data']}")

    context_text = "\n".join(context_parts) if context_parts else "No specific context."
    user_message = f"Context:\n{context_text}\n\nUser question: {message}"

    try:
        logger.info("Calling OpenAI chat completion for query: %s", message[:80])
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT_CHAT},
                {"role": "user", "content": user_message},
            ],
            temperature=0.7,
            max_tokens=500,
        )
        return response.choices[0].message.content or ""
    except Exception as exc:
        logger.warning("OpenAI chat failed (%s); using fallback response.", exc)
        return _generate_chat_fallback(message, context)
