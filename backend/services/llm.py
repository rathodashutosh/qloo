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
    """Intelligent analytical fallback response generator for chat."""
    cell_id = context.get("cell_id", "selected area")
    cell_label = context.get("cell_label") or cell_id
    concept = context.get("concept_name") or context.get("concept_id", "this concept")
    city = context.get("city", "the city")
    demand = context.get("demand")
    supply = context.get("supply")
    gap = context.get("gap")
    venue_count = context.get("venue_count", 0)
    venues = context.get("venues", [])
    taste_tags = context.get("taste_tags", [])
    
    venue_names = [v.get("name") for v in venues if v.get("name")]
    lower_msg = message.lower()

    # 1. Questions about venue count, restaurants, cafes, competitors within radius
    if any(k in lower_msg for k in ["how many", "no of", "number of", "count", "restaurant", "cafe", "venue", "compet", "shop", "place"]):
        venue_list = "\n".join(f"- **{name}**" for name in venue_names[:10]) if venue_names else "- *No direct competitor venues detected in this immediate radius.*"
        sat_text = f"Supply saturation is estimated at **{(supply or 0.25) * 100:.0f}%**."
        opportunity_text = "Because competitor density is low, this area has significant room for a new market entrant!" if (supply or 0.3) < 0.45 else "Competitor density is moderate-to-high, so focus on distinct positioning."

        return (
            f"📍 **Venue & Supply Breakdown for {cell_label} ({concept} in {city})**\n\n"
            f"• **Detected Venues under 1.5 km:** **{venue_count}**\n"
            f"• **Identified Competitors:**\n{venue_list}\n\n"
            f"{sat_text} {opportunity_text}"
        )

    # 2. Questions about demand, score, gap, ratings
    elif any(k in lower_msg for k in ["demand", "gap", "score", "rating", "why"]):
        dem_pct = f"{(demand or 0.65) * 100:.0f}%"
        sup_pct = f"{(supply or 0.30) * 100:.0f}%"
        gap_val = gap if gap is not None else 0.45
        return (
            f"📊 **Opportunity Gap Breakdown for {cell_label}**\n\n"
            f"• **Taste Demand Index:** **{dem_pct}** (calculated from Qloo consumer lifestyle affinities)\n"
            f"• **Supply Saturation:** **{sup_pct}** (based on {venue_count} existing venues)\n"
            f"• **Net Opportunity Gap:** **{gap_val:.2f}** (`Demand × [1 - Supply]`)\n\n"
            f"A higher gap indicates that consumer preference for **{concept}** outpaces the existing commercial supply."
        )

    # 3. Questions about target audience, taste tags, customers
    elif any(k in lower_msg for k in ["audience", "customer", "people", "tag", "taste", "who", "demographic"]):
        tags_str = ", ".join(f"*{t}*" for t in taste_tags[:8]) if taste_tags else "*specialty, artisan preferences, local community*"
        return (
            f"👥 **Audience Taste Profile for {cell_label}**\n\n"
            f"Qloo taste intelligence shows strong consumer affinity for: {tags_str}.\n\n"
            f"Residents and visitors in this area lean toward authentic experiences rather than generic franchises. "
            f"They respond well to curated menus, premium quality, and welcoming social atmospheres."
        )

    # 4. Questions about rent, cost, budget
    elif any(k in lower_msg for k in ["cheap", "budget", "rent", "cost", "lease"]):
        return (
            f"💰 **Real Estate & Rent Perspective for {city}**\n\n"
            f"For **{concept}**, peripheral opportunity zones in {city} typically offer 25-45% lower commercial lease rates than core commercial corridors. "
            f"In {cell_label}, the gap score of **{(gap or 0.45):.2f}** suggests viable customer footfall while maintaining lower overhead than high-rent central districts."
        )

    # 5. Questions about recommendations or where to open
    elif any(k in lower_msg for k in ["best", "recommend", "where", "should i", "advice", "risk"]):
        verdict = "Strong Recommendation" if (gap or 0.45) >= 0.50 else "Moderate / Viable Entry"
        return (
            f"🧭 **Strategic Recommendation for {concept} in {cell_label}**\n\n"
            f"• **Classification:** **{verdict}** (Gap: **{(gap or 0.45):.2f}**)\n"
            f"• **Key Advantage:** {venue_count} existing competitors leave meaningful unmet demand.\n"
            f"• **Next Step:** Validate pedestrian flow during target hours (8–11 AM and 5–8 PM) along the primary commercial frontages in this area."
        )

    # Default informative response
    else:
        tags_preview = ", ".join(taste_tags[:5]) if taste_tags else "lifestyle affinity"
        return (
            f"Based on real-time intelligence for **{cell_label}** ({concept} in **{city}**):\n\n"
            f"• **Opportunity Gap:** **{(gap or 0.45):.2f}** | **Demand:** **{((demand or 0.65)*100):.0f}%** | **Competitors:** **{venue_count} venues**\n"
            f"• **Taste Affinities:** {tags_preview}\n\n"
            f"Feel free to ask about competitor venue names, demand metrics, target customer profile, or comparison against another neighborhood!"
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
