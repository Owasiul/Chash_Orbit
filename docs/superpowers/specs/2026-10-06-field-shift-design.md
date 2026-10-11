# Field Shift: Architectural Design Specification

**Date:** 2026-10-06  
**Challenge:** NASA Space Apps 2026 - Field Shift: Adapting Farms with NASA Data  
**Primary Goal:** Create a demo-ready prototype with real NASA API integration for judging

## 1. Problem Understanding

Farmers face challenges from shifting temperatures, changing rainfall patterns, water shortages, extreme weather, and declining soil health. These pressures make it difficult to choose crop rotations that protect fields, conserve water, and support long-term resilience.

Field Shift is a farmer-facing decision-support tool that uses NASA Earth observations along with local soil information, crop characteristics, and farmer priorities to help farmers explore rotation strategies that could strengthen soil health and adapt farms to changing conditions.

## 2. Success Criteria

Based on the challenge brief and user requirements:

### Core Functionality (must work in <90 seconds for demo):
1. Drop a pin on a field (or pick a sample farm)
2. Load NASA climate + soil + vegetation for that location
3. Set farmer priorities (soil, water, income, climate risk)
4. Compare 2–3 rotation plans
5. See a clear recommendation with “why this works here”

### Technical Requirements:
- Real NASA API calls only (using provided API keys)
- No fallback to sample data (per user request)
- Persist farm + plans in localStorage
- Ship 4 sample farms so judges can skip setup
- Mobile-first responsive design
- NASA data attribution visible

### Acceptance Criteria:
- Landing, setup, observatory, planner, compare, plan, learn pages all work
- At least one LIVE NASA POWER point query by lat/lon succeeds and renders temperature + rainfall
- Sample farms work fully (with real API data)
- Changing a crop in the planner updates scores immediately
- Comparison shows a winner aligned to user's priority weights
- Recommendation text cites a NASA dataset by name
- Mobile layout is usable
- NASA attribution is visible
- No broken interactions, no placeholder "lorem" copy

## 3. System Architecture

### 3.1 High-Level Architecture
```
┌─────────────────┐    ┌──────────────────┐    ┌────────────────────┐
│   Next.js Frontend │◄──►│  Python/FastAPI  │◄──►│  NASA APIs         │
│  (React + TS)    │    │   Backend        │    │ (POWER, SMAP, GPM) │
└─────────────────┘    └──────────────────┘    └────────────────────┘
        │                          │
        ▼                          ▼
┌─────────────────┐    ┌──────────────────┐
│ localStorage    │    │  NASA API Keys   │
│ (farm data,     │    │  (provided)      │
│  plans, prefs)  │    └──────────────────┘
└─────────────────┘
```

### 3.2 Component Breakdown

#### Frontend (Next.js + TypeScript)
- **Framework:** Next.js 14+ with App Router
- **Language:** TypeScript
- **UI Library:** Shadcn UI (built on Radix UI + Tailwind CSS)
- **Forms:** React Hook Form with Zod validation
- **State Management:** React Context + useState/useReducer (avoiding heavy libraries for demo)
- **Data Fetching:** SWR or React Query for caching NASA API responses
- **Charts:** Recharts (lightweight, SVG-based)
- **Map:** Leaflet with React-Leaflet (OSM basemap, no paid keys)
- **Styling:** Tailwind CSS with custom NASA-inspired theme

#### Backend (Python + FastAPI)
- **Framework:** FastAPI
- **Language:** Python 3.9+
- **API Endpoints:** Proxy endpoints for NASA APIs (to handle CORS and API key management)
- **Caching:** In-memory cache with TTL for NASA API responses
- **Validation:** Pydantic models for request/response validation
- **Error Handling:** Proper HTTP status codes and error messages

### 3.3 Data Flow

1. **User Interaction:**
   - User interacts with Next.js frontend (map, forms, planners)
   - Frontend makes requests to FastAPI backend

2. **Backend Processing:**
   - FastAPI receives request, validates parameters
   - Backend calls appropriate NASA API with stored API keys
   - Backend processes/transforms data as needed
   - Returns processed data to frontend

3. **NASA API Integration:**
   - Primary: NASA POWER Agroclimatology API (T2M, T2M_MAX, T2M_MIN, PRECTOTCORR, etc.)
   - Secondary: SMAP soil moisture (via CMR or fallback to climatology)
   - Tertiary: GPM IMERG precipitation
   - Optional: MODIS/VIIRS NDVI or vegetation proxies

### 3.4 Key Technical Decisions

#### Why Next.js + TypeScript + Shadcn UI?
- Next.js provides excellent performance, SEO, and developer experience
- TypeScript ensures type safety for complex data structures from NASA APIs
- Shadcn UI provides accessible, customizable components that match the "orbital agriculture" visual theme
- React Hook Form is lightweight and performant for complex forms

#### Why Python + FastAPI?
- FastAPI is fast, modern, and provides automatic OpenAPI documentation
- Python has excellent libraries for scientific data processing (if needed)
- Easy to deploy and scales well for demo purposes
- Handles CORS issues when calling NASA APIs from browser

#### Why Real NASA API Calls Only?
- Per user request: "Real API calls only"
- Ensures authenticity for judging - shows we can actually access NASA data
- No misleading sample data that might not represent real conditions
- Demonstrates actual integration capability

## 4. Page-by-Page Structure

### 4.1 Landing Page (/)
- Hero section with satellite-over-farm visual
- CTA buttons: "Open a sample farm" + "Pin my field"
- Proof chips showing NASA data sources being used
- 60-second "how it works" animation/video
- Minimal marketing copy - focused on getting users to try

### 4.2 Setup Wizard (/setup) - 4 Steps
1. **Location:** Search place name OR click map OR use sample farm
2. **Field:** Size, irrigation, soil texture, current/last crop
3. **Priorities:** Sliders for soil health, water conservation, climate resilience, income stability (sum to 100)
4. **Constraints:** Growing season months, labor level, legume/livestock options

### 4.3 Field Observatory (/field)
- Map showing pin + 20-50km context
- Four NASA signal cards with sparklines + 10-year trends:
  1. Temperature / Land Surface Temperature (POWER T2M, LST)
  2. Rainfall vs climatology (GPM IMERG / POWER PRECTOTCORR)
  3. Root-zone soil moisture (SMAP)
  4. Vegetation vigor NDVI (MODIS/VIIRS)
- Derived farm-risk badges (computed from NASA data)
- Plain-language bullets: "What this means for rotation"
- Climate shift panel: last 10 years vs prior 10 years

### 4.4 Crop Library (/crops)
- Filterable crop cards with key attributes:
  - Family, season, water demand, root depth, N effect
  - Soil benefit, heat/drought/flood tolerance, yield band
  - Companion/avoid-after lists
- Regional defaults highlighting crops suited to selected farm
- Include: maize, soybean, wheat, rice, sorghum, millet, barley, chickpea, cowpea, lentil, alfalfa, clover, cotton, potato, sunflower, canola, cover-rye, fallow/cover

### 4.5 Rotation Planner (/planner)
- Timeline of 3-5 seasons/years
- Each slot: crop picker + optional cover crop + irrigation intensity
- Live score strip updating as farmer changes slots:
  - Soil health · Water · Climate fit · Income · Overall
- Guardrails (soft warnings):
  - Same family 2 years in a row
  - High-water crop in dry-signal location
  - No nitrogen fixer/legume in 4+ years
  - Bare fallow on high-erosion soil
- One-click "suggest a rotation" using NASA signals + priorities

### 4.6 Compare (/compare)
- 2-3 strategies side by side:
  - A. Business as usual (current practice)
  - B. Field Shift recommended
  - C. Optional custom
- Radar/grouped bars: soil, water, climate, income
- 10-year soil-health trajectory chart (index 0-100)
- Water budget: estimated mm/season vs NASA rainfall + SMAP
- Resilience stress test: score under +1.5°C / -15% rain / +20% rain
- Winner callout tied to farmer's stated priorities

### 4.7 Plan Detail (/plan/:id)
- Season-by-season calendar with "why this crop, this year"
- Citations to NASA signals driving each choice
- Soil narrative: organic matter, N balance, erosion cover, pest break
- Export: printable 1-page plan + JSON + shareable link hash
- Assumptions & limitations (honest, short)

### 4.8 Learn (/learn)
- For judges and curious farmers:
  - Which NASA datasets, what they measure, resolution, cadence
  - How raw observations become farm scores (formulas)
  - Soil-health rotation principles (legumes, cover, diversity)
  - Links to POWER, SMAP, GPM, Earthdata, NASA Harvest, Crop-CASMA
  - Disclaimer: decision support, not agronomic advice

## 5. Data Layer (NASA + Local)

### 5.1 NASA Sources (Priority Order)
1. **NASA POWER Agroclimatology API**
   - Endpoint: https://power.larc.nasa.gov/api/temporal/daily/point
   - Parameters: T2M, T2M_MAX, T2M_MIN, PRECTOTCORR, RH2M, ALLSKY_SFC_SW_DWN, WS2M
   - Community: AG (Agroclimatology)
   - No key required for basic use (but we'll use provided keys)

2. **SMAP Soil Moisture**
   - Surface + root zone monthly climatology
   - Via NASA CMR or earthaccess library

3. **GPM IMERG Precipitation**
   - Monthly anomaly vs 20-year mean

4. **MODIS/VIIRS NDVI**
   - Vegetation vigor proxy
   - Fallback to NASA POWER vegetation proxies if needed

### 5.2 Complementary Data (Clearly Labeled)
- Soil texture/organic carbon table by agro-region (static JSON, SoilGrids-like)
- Crop coefficient (Kc) and typical water need (FAO-style table)
- Simple crop calendars by region

### 5.3 Caching Strategy
- Client-side cache POWER responses by lat/lon + date range
- Backend in-memory cache with TTL (1 hour) for NASA API responses
- Attribute every chart: "Source: NASA POWER / SMAP / GPM IMERG"

## 6. Decision Engine

### 6.1 Location Climate Profile (from NASA POWER last 10 years)
- Mean growing-season Tmax, Tmin
- Total growing-season rain
- Rainfall CV (variability)
- Count of heat-stress days
- Dry-spell length
- Trend: slope of Tmax and precip (warming/drying)

### 6.2 Crop Fitness for a Year (0-100)
- **climateFit** = heatTol, droughtTol, floodTol vs location profile
- **waterFit** = crop water demand vs rain + irrigation + SMAP
- **soilFit** = texture match + root depth vs compaction/erosion risk

### 6.3 Rotation Quality (Sequence)
- **diversity** = Shannon-like over families (min 3 families in 4 years)
- **nitrogenBalance** = legumes/N-fixers vs heavy feeders
- **soilCover** = residue + cover vs bare
- **pestBreak** = avoid same family back-to-back
- **waterLoad** = high-Kc crops stacked in dry years = penalty
- **climateHedge** = mix of drought-tolerant + income crop

### 6.4 Farmer-Weighted Overall
- overall = wSoil*soil + wWater*water + wClimate*climate + wIncome*income
- Weights from setup sliders (normalized to sum=1.0)

### 6.5 Recommendation Generation
- Heuristic approach (no ML required):
  - Insert legume if N-balance poor
  - Swap high-water crop for sorghum/millet/chickpea if SMAP dry
  - Add winter cover if erosion/soil score low
  - Diversify if same crop dominates
- Always explain in one sentence per change, citing a NASA number

## 7. UI/Visual Design

### 7.1 Visual Theme: Orbital Agriculture
- **Colors:**
  - Deep night-sky navy (#0A1A2F)
  - NASA-blue highlights (#00BFFF)
  - Fertile soil umber (#8B4513)
  - Crop green (#228B22)
  - Dry-gold for drought (#DAA520)
  - Rain-teal for moisture (#008080)
- **Typography:**
  - Headings: IBM Plex Sans (condensed, strong)
  - Body: Source Serif (readable, field-note feel)
  - Numbers: Monospace for data precision

### 7.2 Key UI Components
- **Field map with pin** (Leaflet + custom marker)
- **Signal cards with sparklines** (Recharts + custom styling)
- **Priority sliders** (Shadcn UI slider with labels)
- **Year-slot rotation builder** (drag-and-drop or click-to-change)
- **Comparison radar** (Recharts radar chart)
- **Soil trajectory line chart** (Recharts line chart)
- **Recommendation banner** with NASA citation chips

### 7.3 Responsiveness & Accessibility
- Mobile-first: works at 390×844 (iPhone SE size)
- Touch-friendly: 44px minimum touch targets
- Keyboard navigation: all interactive elements accessible
- Color contrast: WCAG AA minimum
- Labels on all sliders, charts, and form elements
- ARIA labels for dynamic content

### 7.4 Loading & Error States
- **Loading:** Skeleton cards + "Asking NASA POWER for this point..."
- **Error:** "Couldn't reach NASA POWER -- showing error state" (no fallback per user request)
- **Empty:** Clear guidance on what to do next

## 8. Sample Data & Demo Script (for Judges)

### 8.1 Sample Farms (Pre-configured)
Since we're using real API calls only, we'll pre-select locations for 4 representative farms:
1. **Iowa corn–soy belt** (temperate, high yield, soil carbon concern)
2. **Punjab wheat–rice** (monsoon, groundwater stress)
3. **Sahel millet–sorghum–cowpea** (heat, rainfall variability)
4. **Central Valley orchard + cover** (drought, ET stress)

### 8.2 Demo Script (90 seconds)
1. Open Punjab sample farm
2. Show rainfall anomaly + soil moisture deficit from real NASA data
3. Show status-quo rice–wheat scoring poorly on water + soil
4. Show recommended: wheat – chickpea – rice – mung with dry-season pulse
   - Explanation: "IMERG/POWER show monsoon variability and SMAP shows dry-downs"
5. Compare charts; farmer who weighted water + soil sees clear win
6. Open Learn: show datasets + formulas used

## 9. Technical Implementation Plan

### 9.1 Project Structure
```
field-shift/
├── .github/
├── .gitignore
├── docs/
│   └── superpowers/
│       └── specs/
├── frontend/                 # Next.js app
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx          # Landing
│   │   ├── setup/
│   │   ├── field/
│   │   ├── crops/
│   │   ├── planner/
│   │   ├── compare/
│   │   ├── learn/
│   │   └── plan/
│   ├── components/
│   ├── lib/
│   │   ├── api/              # API service layer
│   │   ├── utils/
│   │   └── hooks/
│   ├── styles/
│   ├── public/
│   ├── next.config.js
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── package.json
├── backend/                  # FastAPI app
│   ├── app/
│   │   ├── main.py
│   │   ├── api/
│   │   │   ├── deps.py
│   │   │   ├── endpoints/
│   │   │   │   ├── power.py
│   │   │   │   ├── smap.py
│   │   │   │   ├── gpm.py
│   │   │   │   └── modis.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   └── security.py
│   │   ├── models/
│   │   ├── services/
│   │   │   ├── nasa_service.py
│   │   │   └── calculation_service.py
│   │   └── utils/
│   ├── requirements.txt
│   └── Dockerfile
├── README.md
├── .env.example
└── docker-compose.yml
```

### 9.2 Development Milestones
1. **Week 1:** Project setup, basic navigation, sample farm selection
2. **Week 2:** NASA API integration (POWER first), field observatory
3. **Week 3:** Crop library, rotation planner basic version
4. **Week 4:** Comparison engine, plan detail page
5. **Week 5:** Learn page, polishing, demo preparation

### 9.3 Risk Mitigation
- **API Rate Limits:** Implement caching, batch requests where possible
- **API Failures:** Clear error messages, no fallback (per user request)
- **Performance:** Optimize charts, lazy-load heavy components
- **Browser Compatibility:** Test on Chrome, Firefox, Safari mobile/desktop

## 10. Open Issues & Decisions Needed

1. **Authentication:** Should we implement user login for saving plans long-term? (No - per brief: "NO AUTH. Persist farm + plans in localStorage.")
2. **Offline Support:** Should we cache data for offline use? (Limited - focus on online demo reliability)
3. **Advanced Analytics:** Should we include ML-based predictions? (No - keep heuristic as specified)
4. **Social Features:** Should we allow sharing plans? (Yes - via shareable link hash)

## 11. Conclusion

This architectural design provides a comprehensive blueprint for building Field Shift - a production-quality web app for the NASA Space Apps Challenge that helps farmers make data-driven crop rotation decisions using real NASA Earth observation data. The design follows the challenge brief precisely while incorporating the user's specific technology preferences and requirements for real API integration only.

The modular architecture separates concerns effectively, uses modern technologies appropriate for the task, and ensures we can deliver a demo-ready prototype that meets all acceptance criteria while showcasing genuine NASA data integration.