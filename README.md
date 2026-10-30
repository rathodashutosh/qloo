# 🧭 Taste-Gap Finder

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**"Where should this business open?"** — A location intelligence tool for the Qloo LLM Hackathon.

## What It Does

Enter a city and a business concept (e.g., "live-music cafe"). The tool analyzes:
- **Demand**: How strongly the area's population leans toward this concept (Qloo taste data)
- **Supply**: How saturated the area already is with that kind of venue (OpenStreetMap data)
- **Gap Score**: `Demand × (1 - Supply)` — high gap = people want it, nobody is serving it

The result is a heatmap showing opportunity zones, plus an AI-generated business brief for each area.

## Architecture

```
React + MapLibre (frontend)  <-->  FastAPI (backend)  <-->  Qloo API (demand)
                                       |              <-->  OSM Overpass (supply)
                                       |              <-->  LLM (explanations)
                                       +--> SQLite Cache
```

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- Qloo API Key (hackathon)
- OpenAI API Key (for reports)

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your API keys
python -m uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Seed Demo Data
```bash
cd backend
python seed.py
```

Open http://localhost:3000

## Concepts
| Concept | Emoji | Description |
|---------|-------|-------------|
| Specialty Coffee | ☕ | Third-wave, artisan coffee shops |
| Live Music Venue | 🎵 | Bars/cafes with live performances |
| Board Game Cafe | 🎲 | Cafes with board games |
| Bookstore Cafe | 📚 | Combined bookstore + cafe |
| Vegan Restaurant | 🌱 | Plant-based dining |
| Co-working Cafe | 💻 | Work-friendly cafe spaces |
| Craft Brewery | 🍺 | Microbrewery taprooms |
| Natural Wine Bar | 🍷 | Natural/organic wine bars |

## API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/concepts | List all concepts |
| GET | /api/map?city=...&concept=... | Cell scores for heatmap |
| GET | /api/cell/:id?concept=... | Cell breakdown |
| POST | /api/report | Generate LLM business brief |
| POST | /api/live-query | Live Qloo query for a point |
| POST | /api/chat | Follow-up questions |

## Team
Built for the Qloo LLM Hackathon 2026.

## License
Distributed under the [MIT License](LICENSE). See `LICENSE` for more information.
