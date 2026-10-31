# 🧭 Taste-Gap Finder

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB.svg?logo=react&logoColor=black)](https://reactjs.org)
[![MapLibre](https://img.shields.io/badge/Map-MapLibre%20GL-396BFF.svg?logo=maplibre&logoColor=white)](https://maplibre.org)
[![Gemini AI](https://img.shields.io/badge/AI-Google%20Gemini-8E75C4.svg?logo=google&logoColor=white)](https://ai.google.dev)

**"Where should this business open?"** — An AI-powered commercial location intelligence engine built for the **Qloo Hackathon**.

Taste-Gap Finder identifies optimal expansion zones by combining cultural taste signals from the **Qloo API** with real-world competitor saturation from **OpenStreetMap (OSM)**, synthesized into actionable executive market briefs using **Google Gemini AI**.

---

## 🌟 Key Features

- **Spatial Taste-Gap Heatmap**: Evaluates commercial opportunity per neighborhood grid cell using the formula:
  $$\text{Opportunity Gap Score} = \text{Demand} \times (1 - \text{Supply})$$
  - **Demand**: Demographic lifestyle alignment and consumer affinities from Qloo.
  - **Supply**: Direct competitor venue density within a 1.5 km catchment radius from OpenStreetMap.
  - **Gap Score**: High demand combined with low competition = Prime opportunity zone.
- **Live Coordinate Query**: Click anywhere on the map to drop a high-contrast location pin, visualize the **1.5 km catchment radius**, and query real-time Qloo affinities and nearby venues for any custom coordinates.
- **Dual Location Compare Mode**: Compare any two neighborhoods or GPS points head-to-head with side-by-side metric tables (Demand, Saturation, Gap, Venue counts) and an **AI Head-to-Head Comparative Verdict**.
- **Gemini AI Location Assistant**: Inquire about student footfall, commuter traffic, pricing strategies, menu mix, delivery vs. dine-in potential, or custom cuisine formats.
- **Searchable Concept Picker**: 16+ curated presets (Specialty Coffee, Bakeries, Ramen, Natural Wine Bar, Craft Brewery, Vegan, etc.) plus real-time dynamic search and custom concept analysis.
- **Balanced Interface**: Default 50:50 map-to-analytics split with instant layout switchers (`⚖️ 50:50 Balanced`, `📊 40% Map (Data Focus)`, `🗺️ 60% Map`) and a vertically resizable AI chat pane.

---

## 🏗️ Architecture

```
React 18 + MapLibre GL (Frontend)  <───>  FastAPI (REST Backend)
               │                                   │
               │                                   ├─► Qloo Taste API (Demand signals)
               │                                   ├─► OSM Overpass / Nominatim (Supply & Venues)
               │                                   ├─► Google Gemini API (Reports & Chat Assistant)
               │                                   └─► SQLite (Spatial Cache & Scores)
```

---

## 🚀 Quick Start

### Prerequisites
- **Python 3.10+**
- **Node.js 18+** & **npm**
- **Qloo API Key** (Hackathon key)
- *(Optional)* **Gemini API Key** or **OpenAI API Key** (for live AI briefs and chat)

### 1. Backend Setup
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Add your QLOO_API_KEY and GEMINI_API_KEY in backend/.env
python -m uvicorn main:app --reload --port 8000
```
Backend runs at [`http://127.0.0.1:8000`](http://127.0.0.1:8000).

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open [`http://localhost:3000`](http://localhost:3000) in your browser.

### 3. Seed Local Data (Optional)
```bash
cd backend
python seed.py
```

---

## ☕ Preset Business Concepts

| Concept | Category | Description |
|---|---|---|
| **Specialty Coffee** | Cafes | Third-wave, artisan espresso & roasteries |
| **Bakery & Patisserie** | Bakeries | Artisanal sourdough, viennoiserie, pastries |
| **Boba & Bubble Tea** | Cafes | Modern milk teas, fruit boba, matcha bars |
| **Co-working Cafe** | Cafes | Laptop-friendly spaces with high-speed Wi-Fi |
| **Bookstore Cafe** | Cafes | Combined literary bookshop & quiet cafe |
| **Board Game Cafe** | Cafes | Tabletop gaming & social dining lounge |
| **Chinese Restaurant** | Dining | Dim sum, hand-pulled noodles, regional Chinese |
| **Ramen & Japanese** | Dining | Izakaya, authentic noodle bars, sushi |
| **Italian Trattoria** | Dining | Wood-fired pizza, handmade pasta & wine |
| **Vegan Restaurant** | Dining | Plant-based comfort food & organic dining |
| **Korean BBQ** | Dining | Grill-at-table dining, banchan, Korean comfort |
| **Artisan Gelato** | Sweets | Scratch-made gelato, sorbet, dessert parlors |
| **Craft Brewery** | Bars | Microbrewery taprooms & local craft beer |
| **Natural Wine Bar** | Bars | Biodynamic, natural & organic wine lounges |
| **Cocktail Speakeasy** | Bars | Bespoke craft cocktails & intimate nightlife |
| **Live Music Venue** | Bars | Jazz clubs, acoustic lounges, indie stages |

*You can also type and search any custom concept in the app's Concept Picker.*

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health status |
| `GET` | `/api/concepts` | List all configured business concepts |
| `GET` | `/api/map?city=...&concept=...` | Spatial GeoJSON hex cells with opportunity gap scores |
| `GET` | `/api/cell/{id}?concept=...` | Detailed breakdown of a specific hexagon cell |
| `POST` | `/api/live-query` | Real-time Qloo demand & OSM competitor query for any GPS coordinate |
| `POST` | `/api/report` | Generate executive AI business brief |
| `POST` | `/api/chat` | Interactive location intelligence assistant with contextual memory |
| `GET` | `/api/settings/keys` | Check status of configured API keys |

---

## 👥 Team
Built for the **Qloo Hackathon 2026**.

## 📄 License
This project is open-source and distributed under the [MIT License](LICENSE).
