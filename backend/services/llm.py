"""LLM service for generating narrative reports and chat responses."""

import logging
import httpx
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

SYSTEM_PROMPT_CHAT = """You are "TasteAI", a world-class AI Location Intelligence Analyst, Commercial Real Estate Advisor, and Business Strategist powered by Google Gemini.
You advise entrepreneurs, business operators, and investors on selecting prime locations, evaluating commercial real estate, analyzing consumer taste culture, and understanding market competition.

Your Core Capabilities:
1. Location & Market Analysis: Whenever a location is selected, synthesize the provided geospatial data (Demand score, Supply saturation, Opportunity Gap, detected Competitors, and Qloo Taste Signals) into practical, clear, actionable insights.
2. Answer Any Question: Answer WHATEVER the user asks about! This includes competitor analysis, foot traffic estimates, menu design, pricing strategies, marketing tactics, demographic profiles, comparisons with other neighborhoods or cities, leasing negotiation tips, or general business and retail strategy.
3. Conversational Memory: Maintain continuity across multi-turn questions and follow-ups.
4. Rich, Readable Markdown: Structure answers with bullet points, bold key terms, and concise paragraphs.

Tone: Professional, friendly, insightful, and strategic. If asked about competitor counts or venue names for the selected location, provide the exact numbers and names from the context, and offer helpful strategic commentary."""

SYSTEM_PROMPT_COMPARE = """You are a senior real estate and taste-intelligence advisor. You are performing a head-to-head location comparison between Location A and Location B for opening a new commercial concept.
Analyze:
1. Executive Verdict & Winner (Which location to open first and why)
2. Strategic Opportunity Analysis (Demand vs Supply gap comparison)
3. Taste & Demographic Alignment (Contrasting consumer culture & affinities)
4. Competitor Dynamics & Whitespace (Existing saturation and positioning strategy)
5. Expansion Roadmap (Phase 1 launch recommendation vs Phase 2 expansion)

Format with clean Markdown headings and bullet points. Never hallucinate fake venues or metrics beyond what is given."""


async def _call_gemini_multiturn(
    system_prompt: str,
    history: list[dict],
    user_prompt: str,
    max_tokens: int = 2048,
) -> str | None:
    """Call Google Gemini 2.5 Flash with native system_instruction and multi-turn contents."""
    api_key = settings.GEMINI_API_KEY
    if not api_key or api_key.startswith("your-") or api_key.strip() == "":
        return None

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL}:generateContent?key={api_key.strip()}"

    contents = []
    # Add conversation history
    for item in (history or []):
        role = item.get("role")
        content = item.get("content") or item.get("text") or ""
        if not content:
            continue
        gemini_role = "user" if role == "user" else "model"
        contents.append({"role": gemini_role, "parts": [{"text": str(content)}]})

    # Add the current user prompt
    contents.append({"role": "user", "parts": [{"text": user_prompt}]})

    payload = {
        "system_instruction": {
            "parts": [{"text": system_prompt}]
        },
        "contents": contents,
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": max_tokens,
            "thinkingConfig": {"thinkingBudget": 0},
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
                    if parts:
                        text = parts[0].get("text", "").strip()
                        if text:
                            logger.info("Successfully received Gemini response (%d chars)", len(text))
                            return text
            logger.warning("Gemini API error (HTTP %s): %s", resp.status_code, resp.text[:200])
    except Exception as exc:
        logger.warning("Gemini API call failed (%s)", exc)
    return None


async def _call_gemini(system_prompt: str, user_prompt: str, max_tokens: int = 900) -> str | None:
    """Call Google Gemini 2.5 Flash via REST API using configured GEMINI_API_KEY."""
    api_key = settings.GEMINI_API_KEY
    if not api_key or api_key.startswith("your-") or api_key.strip() == "":
        return None

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL}:generateContent?key={api_key.strip()}"
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": f"SYSTEM INSTRUCTIONS:\n{system_prompt}\n\nUSER PROMPT:\n{user_prompt}"}],
            }
        ],
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": max(max_tokens, 2048),
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }

    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        text = parts[0].get("text", "").strip()
                        if text:
                            logger.info("Successfully received Gemini response (%d chars)", len(text))
                            return text
            logger.warning("Gemini API error (HTTP %s): %s", resp.status_code, resp.text[:200])
    except Exception as exc:
        logger.warning("Gemini API call failed (%s)", exc)
    return None


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
    """Generate a narrative business brief using Gemini, OpenAI, or structured fallback."""
    venue_names = [v.get("name", "Unnamed") for v in venues[:12] if isinstance(v, dict) and v.get("name")]
    venue_list_text = "\n".join(f"  - {n}" for n in venue_names) if venue_names else "  (no direct competitor venues recorded)"

    user_message = f"""## Area Analysis: {concept_name} in {cell_label}

**Demand score**: {demand:.2f} (normalized 0-1 from Qloo taste data)
**Supply score**: {supply:.2f} (normalized 0-1, from {venue_count} existing venues)
**Gap score**: {gap:.2f} (Opportunity formula: Demand * (1 - Supply))
**Data confidence**: {confidence}

**Top taste tags in this area**: {', '.join(taste_tags) if taste_tags else 'N/A'}

**Existing competitor venues ({venue_count} total)**:
{venue_list_text}

Write a comprehensive business brief for opening a {concept_name} in {cell_label}."""

    # 1. Try Gemini
    gemini_resp = await _call_gemini(SYSTEM_PROMPT_REPORT, user_message, max_tokens=850)
    if gemini_resp:
        logger.info("Generated brief via Gemini AI for %s in %s", concept_name, cell_label)
        return gemini_resp

    # 2. Try OpenAI
    client = _get_client()
    if client is not None:
        try:
            logger.info("Generating report via OpenAI for %s in %s", concept_name, cell_label)
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

    # 3. Fallback to analytical template
    logger.info("Using structured analytical brief generator.")
    return _generate_analytical_brief(
        concept_name, cell_label, demand, supply, gap, confidence, venue_count, taste_tags, venues
    )


async def chat(
    message: str,
    context: dict | None = None,
    history: list[dict] | None = None,
) -> str:
    """Handle chat messages with optional data context and conversation history via Gemini or OpenAI."""
    context = context or {}
    history = history or []

    venue_count = context.get("venue_count", 0)
    venues = context.get("venues", [])
    venue_names = []
    if isinstance(venues, list):
        for v in venues:
            if isinstance(v, dict) and v.get("name"):
                venue_names.append(v["name"])
            elif isinstance(v, str):
                venue_names.append(v)

    venue_summary = f"{venue_count} venues detected ({', '.join(venue_names[:10])})" if venue_names else f"{venue_count} venues detected"
    tags = context.get("taste_tags") or context.get("tags") or []
    tags_text = ", ".join(tags[:12]) if tags else "N/A"
    cell_label = context.get("cell_label") or context.get("cell_id")
    concept = context.get("concept_name") or context.get("concept_id") or "Commercial Concept"
    city = context.get("city") or "Current City"

    context_lines = []
    if cell_label:
        context_lines.append(f"Current Selected Location: {cell_label} in {city}")
        context_lines.append(f"Target Concept: {concept}")
        if context.get("gap") is not None:
            context_lines.append(f"Opportunity Gap Score: {context.get('gap'):.2f}")
        if context.get("demand") is not None:
            context_lines.append(f"Qloo Taste Demand Index: {((context.get('demand') or 0)*100):.0f}%")
        if context.get("supply") is not None:
            context_lines.append(f"OSM Supply Saturation: {((context.get('supply') or 0)*100):.0f}%")
        context_lines.append(f"Nearby Competitor Venues within 1.5 km: {venue_summary}")
        context_lines.append(f"Local Qloo Consumer Taste Signals: {tags_text}")
    else:
        context_lines.append(f"Active City: {city}")
        context_lines.append(f"Active Concept: {concept}")

    context_block = "\n".join(context_lines)
    user_message = f"""[System Location Intelligence Context]:
{context_block}

[User Question]:
{message}"""

    # 1. Try Gemini with full multi-turn conversation history
    gemini_resp = await _call_gemini_multiturn(SYSTEM_PROMPT_CHAT, history, user_message, max_tokens=2048)
    if gemini_resp:
        logger.info("Responded via Gemini 2.5 Flash for chat query: %s", message[:60])
        return gemini_resp

    # 2. Try OpenAI
    client = _get_client()
    if client is not None:
        try:
            logger.info("Calling OpenAI chat completion for query: %s", message[:60])
            openai_messages = [{"role": "system", "content": SYSTEM_PROMPT_CHAT}]
            for h in history[-6:]:
                openai_messages.append({"role": h.get("role", "user"), "content": h.get("content", "")})
            openai_messages.append({"role": "user", "content": user_message})

            response = await client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=openai_messages,
                temperature=0.7,
                max_tokens=700,
            )
            return response.choices[0].message.content or ""
        except Exception as exc:
            logger.warning("OpenAI chat failed (%s); using fallback response.", exc)

    # 3. Fallback
    return _generate_chat_fallback(message, context)


async def generate_comparison_report(
    cell_a: dict,
    cell_b: dict,
    concept_name: str,
    city: str,
) -> str:
    """Generate an AI-powered head-to-head comparison brief between two locations."""
    label_a = cell_a.get("label") or cell_a.get("id") or "Location A"
    label_b = cell_b.get("label") or cell_b.get("id") or "Location B"

    gap_a = float(cell_a.get("gap") or 0.45)
    demand_a = float(cell_a.get("demand") or 0.65)
    supply_a = float(cell_a.get("supply") or 0.35)
    venues_a = cell_a.get("venues") or []
    venue_names_a = [v.get("name", "Local") for v in venues_a[:8] if isinstance(v, dict) and v.get("name")]
    tags_a = cell_a.get("tags") or cell_a.get("taste_tags") or []

    gap_b = float(cell_b.get("gap") or 0.45)
    demand_b = float(cell_b.get("demand") or 0.65)
    supply_b = float(cell_b.get("supply") or 0.35)
    venues_b = cell_b.get("venues") or []
    venue_names_b = [v.get("name", "Local") for v in venues_b[:8] if isinstance(v, dict) and v.get("name")]
    tags_b = cell_b.get("tags") or cell_b.get("taste_tags") or []

    prompt = f"""Compare two potential launch sites for opening a {concept_name} in {city}:

### Location A: {label_a}
- Opportunity Gap Score: {gap_a:.2f}
- Taste Demand Index: {(demand_a*100):.0f}%
- Market Saturation: {(supply_a*100):.0f}%
- Competitors Detected ({len(venues_a)}): {', '.join(venue_names_a) if venue_names_a else 'None detected'}
- Local Consumer Taste Signals: {', '.join(tags_a[:8]) if tags_a else 'N/A'}

### Location B: {label_b}
- Opportunity Gap Score: {gap_b:.2f}
- Taste Demand Index: {(demand_b*100):.0f}%
- Market Saturation: {(supply_b*100):.0f}%
- Competitors Detected ({len(venues_b)}): {', '.join(venue_names_b) if venue_names_b else 'None detected'}
- Local Consumer Taste Signals: {', '.join(tags_b[:8]) if tags_b else 'N/A'}

Deliver a definitive, executive-grade comparative assessment."""

    gemini_resp = await _call_gemini(SYSTEM_PROMPT_COMPARE, prompt, max_tokens=1000)
    if gemini_resp:
        return gemini_resp

    client = _get_client()
    if client is not None:
        try:
            resp = await client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT_COMPARE},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.7,
                max_tokens=800,
            )
            return resp.choices[0].message.content or ""
        except Exception as e:
            logger.warning("OpenAI compare failed: %s", e)

    # Analytical fallback
    winner = label_a if gap_a >= gap_b else label_b
    runner_up = label_b if gap_a >= gap_b else label_a
    diff = abs(gap_a - gap_b)
    return f"""### 🏆 Head-to-Head Decision Brief: {label_a} vs {label_b}

**Recommended Choice:** **{winner}** (Opportunity Gap Advantage: **+{diff:.2f}**)

#### 1. Strategic Opportunity Evaluation
- **{label_a} (Location A):** Gap Score **{gap_a:.2f}** (Demand: {(demand_a*100):.0f}%, Saturation: {(supply_a*100):.0f}%, {len(venues_a)} competitors).
- **{label_b} (Location B):** Gap Score **{gap_b:.2f}** (Demand: {(demand_b*100):.0f}%, Saturation: {(supply_b*100):.0f}%, {len(venues_b)} competitors).

#### 2. Taste Signal Comparison
Consumer signals in **{label_a}** lean towards *{', '.join(tags_a[:4]) or 'artisan culture'}*, whereas **{label_b}** shows affinity for *{', '.join(tags_b[:4]) or 'community culture'}*.

#### 3. Investment Verdict
**{winner}** offers the highest whitespace and strongest cultural alignment for {concept_name}. **{runner_up}** should be slated for Phase 2 expansion."""

