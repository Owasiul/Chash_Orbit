# Chash Orbit 🌍🛰️

**Earth-to-farm decision system** · NASA Space Apps Challenge

[![Next.js](https://img.shields.io/badge/Next.js-16_App_Router-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwind-css)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-PostgreSQL_(Neon)-2d3748?logo=prisma)](https://prisma.io/)
[![NASA POWER](https://img.shields.io/badge/NASA-POWER_&_MODIS_250m-red?logo=nasa)](https://power.larc.nasa.gov/)

![Chash Orbit Dashboard](public/docs/dashboard-preview.png)

> **Live Deployment:** [chash-orbit.vercel.app](https://chash-orbit.vercel.app) *(or deploy self-hosted using Neon PostgreSQL)*  
> **Interactive Demo:** Click **"Rajshahi Demo Field"** on the single-page dashboard to load a real 2.73-hectare rice-farming parcel in Rajshahi, Bangladesh in < 2 seconds.

---

## The Problem & "How This Solves Field Shift"

Smallholder farmers (such as a Boro-rice grower in Rajshahi, Bangladesh) traditionally decide planting schedules and crop selection based on habit, local seed availability, or short-term commodity prices. Meanwhile:
- Continuous mono-cropping or cereal-after-cereal cycles exhaust soil nitrogen and collapse organic matter.
- Groundwater aquifers rapidly decline from uncalibrated dry-season irrigation.
- Heat stress days and monsoon variability create severe crop vulnerability.

NASA and international Earth-observation satellites observe these thermal, hydrological, and vegetative signals continuously from space. However, raw NetCDF files, 0.5° MERRA-2 grids, and 16-day MODIS arrays never reach the farmer in an actionable form.

**Chash Orbit bridges this gap into a transparent, single-page, Earth-to-farm decision system:**

| Field Shift Challenge Need | Chash Orbit Implementation & Feature |
| :--- | :--- |
| **Field-Level Parcel Delineation** | **Satellite Polygon Map**: Draw custom farm boundaries or load instant presets. Computes live area (hectares/acres), centroid, and bounding box with Turf.js geometry validation (rejects self-intersections and parcels > 5,000 ha). |
| **Ground-Truth Earth Observation** | **Multi-Satellite Telemetry**: Ingests multi-year daily meteorological time series from NASA POWER (~50 km MERRA-2), 16-day dynamic NDVI composites from NASA MODIS Terra MOD13Q1 (250 m resolution via ORNL DAAC), and Sentinel-2 10 m STAC scene queries. |
| **Empirical Bias Calibration** | **South Asia Bias Offset (-0.28)**: Corrects the known systematic 0.24–0.36 NDVI over-estimation in climate-driven vegetation models across South Asia (`lat 6°-37°N, lng 68°-98°E`), reflecting realistic dry-season fallows. |
| **Transparent Crop Suitability** | **Deterministic Decision Engine**: Scores crops across 4 distinct dimensions (Climate, Water, Soil, Rotation) bounded 0–100, weighted dynamically by farmer priorities (soil health, water conservation, climate resilience, net income). |
| **4-Year Sustainable Crop Rotation** | **Multi-Year Rotation Planner**: Enforces agronomic rules: never repeats a plant family in consecutive years, strictly alternates nitrogen-depleting cereals with nitrogen-fixing legumes, and integrates restorative cover crops when soil priority is high. |
| **Climate Shock Resilience** | **Interactive Scenario Testing**: Real-time sliders (-20% precipitation, +2°C warming) re-calculate deterministic fit scores instantly to show farmers how crop resilience shifts under drought and heat stress. |
| **Actionable Decision Guidance** | **Floating Companion Advisor (Gemini 3.5 Flash Lite)**: Skepticism-free AI companion strictly grounded in structured engine JSON. Cites verified decimal scores and telemetry without hallucinating numbers; protected by IP sliding-window rate limiting (30 req/min) and 500-char input limits. |
| **Accessibility & Field Sharing** | **One-Page Printable PDF & Bilingual UI**: Clean browser print layout for field export and full bilingual support (English & Bengali / বাংলা). |

---

## Architecture Diagram

```mermaid
flowchart TD
    subgraph Client["Client Tier (Single-Page App Router)"]
        UI["SinglePageDashboard (/)"]
        Map["Satellite Polygon Map (MapLibre GL + Terra Draw)"]
        State["Zustand Store (App Flow & Telemetry)"]
        Chat["Floating Advisor Chatbot (AdvisorAvatarIcon)"]
    end

    subgraph API["Next.js 16 API Routes"]
        AnalyzeRoute["/api/field/analyze"]
        NdviRoute["/api/field/ndvi"]
        ChatRoute["/api/field/chat (Rate Limited: 30 req/min)"]
        GeoRoute["/api/location (Nominatim & Open-Meteo)"]
    end

    subgraph Engine["Agronomic Decision & Ingestion Tier"]
        DecEngine["Deterministic Decision Engine (engine.ts)"]
        CropLib["Calibrated Crop Library (crops.ts: BARI/BRRI/FAO)"]
        Turf["Turf.js Spatial Polygon Engine (polygon.ts)"]
    end

    subgraph SpaceData["Earth Observation & AI Services"]
        Power["NASA POWER (MERRA-2 Meteorology)"]
        Modis["NASA MODIS Terra MOD13Q1 (250m NDVI via ORNL DAAC)"]
        Sentinel["Sentinel-2 L2A (10m Multispectral STAC)"]
        Gemini["Google Gemini 3.5 Flash Lite (@ai-sdk/google)"]
    end

    subgraph Storage["Database & Caching Tier"]
        Neon["Neon Serverless PostgreSQL"]
        Prisma["Prisma ORM (NasaCache with TTL & Observations)"]
    end

    UI --> Map
    Map --> Turf
    UI --> State
    UI --> Chat
    UI --> AnalyzeRoute
    Chat --> ChatRoute
    Map --> GeoRoute

    AnalyzeRoute --> DecEngine
    AnalyzeRoute --> CropLib
    AnalyzeRoute --> Power
    AnalyzeRoute --> Modis
    AnalyzeRoute --> Sentinel
    AnalyzeRoute --> Prisma

    NdviRoute --> Modis
    ChatRoute --> Gemini
    ChatRoute -.-> DecEngine

    Prisma --> Neon
```

---

## Earth Observation Data — Resolutions & Status

Every single number in Chash Orbit carries a transparent provenance badge (**LIVE · CACHED · DERIVED · DEMO**) along with its spatial resolution. We never present a modeled value as a measured satellite reading.

| Parameter | Platform & Mission | Spatial Resolution | Temporal Resolution | Status Badge | Provenance & Processing Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Temperature, Heat Stress Days, 10y Trend** | [NASA POWER](https://power.larc.nasa.gov/) (MERRA-2 assimilation) | **0.5° × 0.5° (~50 km)** | Daily & 10-year monthly normals | `LIVE` / `CACHED` | Direct centroid assimilation query; cached with 24-hour TTL in PostgreSQL. |
| **Rainfall, Drought, Flood Risks** | NASA POWER `PRECTOTCORR` + GPM IMERG bias correction | **0.5° × 0.5° (~50 km)** | Daily multi-year precipitation | `LIVE` / `CACHED` | Validates wet-day counts, rainfall variability, and seasonal deficits. |
| **Vegetation Index (NDVI) & Seasonal Curve** | NASA **MODIS Terra MOD13Q1** via [ORNL DAAC Subset API](https://modis.ornl.gov/) | **250 m** | 16-day composite | `LIVE` / `CACHED` | Area-window query sized to the drawn polygon. Progressive async retrieval with zero UI blocking. |
| **Sentinel-2 L2A Scene Catalog** | Microsoft Planetary Computer STAC | **10 m** multispectral | 5-day revisit | `LIVE` (STAC reference) | Direct scene reference for fine-scale field visualization. |
| **Root-Zone Soil Moisture Deficit** | Daily Hargreaves-Samani PET water-balance model | **0.5° (~50 km derived)** | Daily calculation | `DERIVED` | Driven by NASA POWER precipitation & thermal profile. Direct SMAP requires Earthdata login. |
| **Soil Texture & Organic Health** | Farmer-reported texture + regional soil heuristics | Field-level | Baseline observation | `DERIVED` / `REPORTED` | Combines farmer inputs with satellite vegetative vitality. |

### South Asia Regional Bias Correction

In global vegetation models driven solely by coarse temperature and rainfall, modeled NDVI runs **0.24–0.36 too high in South Asia** (Bangladesh, India, Pakistan) because coarse climate assimilation misses local post-monsoon cropping calendars and bare-soil fallows.

To solve this:
1. **Live MODIS 250 m is primary:** We pull actual 250 m composite pixels from ORNL DAAC across the polygon boundary.
2. **Empirical bias offset (-0.28):** In derived fallback modes within South Asia (`lat 6°-37°N, lng 68°-98°E`), an empirical offset of `-0.28` is applied (clamped between `0.05` and `0.85`), eliminating systematic inflation while preserving seasonal dynamics.

---

## Calibrated Crop Library Citations

The crop database in [`src/lib/crops.ts`](src/lib/crops.ts) links agronomic requirements to verified research institutions:

| Crop | Plant Family | Season | Water Need | Nitrogen Effect | Agronomic Research Source & Citation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Rice** | Poaceae | Kharif | 1,100 mm | Depleter | **BRRI / FAO** — Bangladesh Rice Research Institute & FAO Irrigation Paper 56 |
| **Wheat** | Poaceae | Rabi | 450 mm | Depleter | **BARI / FAO** — BARI Wheat Research Centre & FAO Paper 56 |
| **Maize** | Poaceae | Kharif | 500 mm | Depleter | **BARI / FAO** — BARI Maize Division & FAO 56 |
| **Potato** | Solanaceae | Rabi | 500 mm | Depleter | **BARI / FAO** — BARI Tuber Crops Research Centre (TCRC) & FAO 56 |
| **Tomato** | Solanaceae | Kharif | 600 mm | Depleter | **BARI / FAO** — BARI Horticulture Research Centre & FAO 56 |
| **Chickpea** | Fabaceae | Rabi | 250 mm | **Fixer** | **BARI / ICRISAT** — BARI Pulses Research Centre & ICRISAT/FAO 56 |
| **Lentil** | Fabaceae | Rabi | 220 mm | **Fixer** | **BARI / FAO** — BARI Pulses Research Centre & FAO 56 |
| **Soybean** | Fabaceae | Kharif | 450 mm | **Fixer** | **BARI / FAO** — BARI Oilseed Research Centre & FAO 56 |
| **Sorghum** | Poaceae | Kharif | 300 mm | Depleter | **FAO** — ICRISAT & FAO Crop Water Management (Paper 56) |
| **Millet** | Poaceae | Kharif | 250 mm | Depleter | **FAO** — ICRISAT & FAO 56 |
| **Mung Bean** | Fabaceae | Summer | 200 mm | **Fixer** | **BARI** — BARI Pulses Research Centre & AVRDC/WorldVeg |
| **Mustard** | Brassicaceae | Rabi | 280 mm | Depleter | **BARI** — BARI Oilseed Research Centre |
| **Cotton** | Malvaceae | Kharif | 600 mm | Depleter | **CDB / FAO** — Cotton Development Board (CDB) Bangladesh & FAO 56 |
| **Vegetables** | Mixed | Year-round | 500 mm | Depleter | `illustrative` — Composite illustrative horticultural parameters |
| **Fruit** | Mixed | Year-round | 700 mm | Neutral | `illustrative` — Composite illustrative perennial orchard profile |

---

## Limitations (Stated Honestly)

1. **Spatial Resolution of Gridded Meteorology:** NASA POWER is provided on a 0.5° × 0.5° grid (~50 km). Microclimates within narrow river valleys or steep mountain terrain may differ from gridded averages.
2. **Sub-Pixel Parcel Size:** MODIS pixels are 250 m across (~6.25 hectares). For smallholder plots under 1 hectare, MODIS observations reflect the composite vegetative vigor of the local agricultural cluster rather than a single isolated furrow.
3. **Model-Derived Soil Moisture:** Root-zone soil moisture is calculated using a Hargreaves-Samani potential evapotranspiration water-balance model driven by daily POWER precipitation and temperatures. In-situ probe telemetry is not included.
4. **Offline Benchmark Dataset (UCI 525):** The UCI remote-sensing crop mapping dataset (id 525) is not bundled locally in `data/`, so external dataset accuracy comparisons were omitted rather than fabricated.

---

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **UI & Components:** React 19, Tailwind CSS 4, shadcn/ui, Lucide Icons
- **Mapping & Spatial Geometry:** MapLibre GL JS, Terra Draw, Turf.js
- **State & Internationalization:** Zustand, custom dictionary-based i18n (`en`, `bn-BD`)
- **Database & Cache:** Prisma ORM, Neon Serverless PostgreSQL (`NasaCache` with automatic TTL expiration)
- **AI & Decision Support:** Google Gemini 3.5 Flash Lite (`gemini-2.0-flash-lite` via `@ai-sdk/google`), Vercel AI SDK

---

## Setup & Local Development

### Prerequisites
- Node.js ≥ 20.9.0
- npm ≥ 10.0.0
- PostgreSQL database (e.g., free tier on [Neon](https://neon.tech))

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone https://github.com/Owasiul/Chash_Orbit.git
   cd Chash_Orbit
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   Configure the following variables in `.env`:
   - `DATABASE_URL`: Connection string for Neon Serverless PostgreSQL (`postgresql://user:pass@ep-xyz.neon.tech/neondb?sslmode=require`).
   - `GOOGLE_GENERATIVE_AI_API_KEY`: *(Optional)* Google Gemini API key for live AI advisor chat. When absent, the system seamlessly uses the grounded deterministic decision generator.
   - `GEMINI_MODEL`: *(Optional, default: `gemini-2.0-flash-lite`)*

3. **Initialize Database:**
   ```bash
   npm run db:push
   ```

4. **Start Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## NPM Scripts

| Script | Purpose |
| :--- | :--- |
| `npm run dev` | Starts Next.js development server with Turbopack on port 3000 |
| `npm run build` | Builds standalone production bundle and copies static assets |
| `npm start` | Launches production server from standalone output |
| `npm run lint` | Runs ESLint across the codebase |
| `npm test` | Runs Node.js native test runner across all 38 unit & integration tests |
| `npm run warm-cache` | Pre-warms NASA POWER & MODIS 250m cache for demo polygons and global locations |
| `npm run db:push` | Synchronizes Prisma schema directly to PostgreSQL (Neon) |
| `npm run db:generate` | Re-generates Prisma client types |

---

## Pre-Warming Demo Cache

To ensure instant (< 2 second) evaluation during demonstrations or judging:

```bash
# When testing locally
npm run warm-cache

# Against a live deployment
BASE_URL=https://your-deployment-domain.com npm run warm-cache
```

Pre-warms polygon boundaries for Rajshahi, Dhaka, Punjab, Iowa, Nile Basin, and Bavaria.
