# Chash Orbit 🌍

**Earth-to-farm decision system** · NASA Space Apps Challenge

Pick any field on a 3D Earth. Chash Orbit pulls NASA satellite and reanalysis
data for that exact point and recommends what to plant next: a ranked crop list
and a 4-year rotation plan, with every score traceable to a NASA signal.

## The problem

Smallholder farmers, like a Boro-rice grower in Rajshahi, Bangladesh, decide
each season what to plant based on habit and local advice. Meanwhile the water
table falls, dry seasons get hotter, and continuous cereals deplete soil
nitrogen. NASA observes all of this from orbit, but that data rarely reaches a
planting decision.

## What Chash Orbit does

1. **Locate:** search a place or spin the globe to a field.
2. **Profile (90 s):** current crop, crops under consideration, irrigation,
   soil (or "I don't know"), and priorities across soil health, water, climate
   and income.
3. **Analyze:** fetch NASA data for the point, compute heat, drought and flood
   risk, and score every candidate crop.
4. **Decide:** see a ranked list of crops, each with a "why" that cites the
   data, and a 4-year rotation that alternates nitrogen-fixing legumes with
   cereals.

Try the one-click demo on the home screen: **"See a demo: rice farmer in
Rajshahi, Bangladesh."**

## NASA data — what's live and what's derived

We label every number in the UI with its source (LIVE · CACHED · DERIVED ·
DEMO). We never present a model estimate as a satellite measurement.

| Signal | Source | Status |
| --- | --- | --- |
| Temperature, heat-stress days, 10-year trend | [NASA POWER](https://power.larc.nasa.gov/) daily + monthly (AG community) | **Live** |
| Rainfall, variability, dry spells, 10-year trend | NASA POWER `PRECTOTCORR` (bias-corrected with GPM IMERG) | **Live** |
| Vegetation (NDVI), 12-month profile | NASA **MODIS Terra MOD13Q1** 250 m 16-day NDVI via the [ORNL DAAC Land Product Subsets API](https://modis.ornl.gov/data/modis_webservice.html) | **Live** |
| Root-zone soil moisture, seasonal deficit | Water-balance model driven by POWER rainfall + temperature (Hargreaves PET) | Derived; SMAP needs Earthdata login |
| Soil texture (when unknown), organic matter, erosion risk | Regional heuristics + NDVI | Derived |

**Model check:** the Signals tab plots observed MODIS NDVI against our
POWER-only NDVI model. At the South Asian demo farms (Rajshahi, Dhaka, Punjab,
Ludhiana) the model runs 0.24–0.36 NDVI high. In Iowa and the Central Valley
it's within 0.1. A climate-only model misses irrigation, cropping calendars and
land cover, which is why we use live MODIS wherever it's available.

**If NASA is unreachable,** the app falls back to deterministic demo values and
every badge turns **DEMO**.

## How the scoring works

For each crop, Chash Orbit computes four 0–100 fit scores:

- **Climate fit:** growing-season temperature vs the crop's optimal window,
  heat tolerance vs heat risk, drought tolerance vs drought risk.
- **Water fit:** annual rainfall vs the crop's seasonal water need, an uplift
  for irrigation, flood tolerance vs flood risk.
- **Soil fit:** root depth vs soil texture, and nitrogen effect.
- **Rotation fit:** a same-family penalty, and a bonus for a legume after a
  cereal (and the reverse).

The overall score is a weighted average using the farmer's own priorities:

```
overall = (climate·Pc + water·Pw + soil·Ps + incomeIndex·Pi + rotation·10) / (Pc + Pw + Ps + Pi + 10)
```

The rotation planner never repeats a crop family in consecutive years. It
alternates nitrogen fixers and depleters, and adds a cover crop when the
soil-health priority is high. The code is in
[`src/lib/decision/engine.ts`](src/lib/decision/engine.ts).

## AI Field Advisor

Chash Orbit now features an LLM-powered agricultural advisor built with the Vercel AI SDK and Google Gemini.

- **AI Field Report:** An automated, plain-language summary of the field analysis. It highlights key environmental risks, explains why top crops were ranked highly, and details the logic behind the rotation plan.
- **Ask Your Field:** A conversational chat interface where farmers can ask questions about their specific field data. The AI explains the reasoning behind scores, discusses crop trade-offs, and answers scenario questions (e.g., "What if it rains less?").
- **Grounded in Data:** The AI acts strictly as an explainer. It does not invent or hallucinate scores, crop rankings, or environmental data. All numerical data rendered in the UI comes strictly from the deterministic decision engine.

## Limitations (stated plainly)

- The crop library (`src/lib/crops.ts`) holds illustrative agronomic values, not
  calibrated local yield models.
- Soil moisture is modelled, not observed. Adding NASA SMAP L4 through Earthdata
  is the next step.
- A MODIS pixel is 250 m. Small or mixed fields will blend with their
  surroundings.
- The first MODIS request for a new location takes about 30 s. Until it
  finishes, the app shows the derived NDVI estimate, then switches to live data
  on the next analysis.

## Tech stack

Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · shadcn/ui ·
react-globe.gl / three.js · recharts · Zustand · Prisma + SQLite (farms + NASA
response cache)

## Getting started

Requires Node.js ≥ 20.9.

```bash
npm install          # also generates the Prisma client
cp .env.example .env
npm run db:push      # create the SQLite database
npm run dev          # http://localhost:3000
```

The crop library seeds itself on the first API call.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server on port 3000 |
| `npm run build` / `npm start` | Production build (standalone) / serve it |
| `npm run lint` | ESLint |
| `npm run db:push` | Sync the Prisma schema to SQLite |
| `npm run warm-cache` | Pre-fetch NASA data for the demo farms (`BASE_URL=…` to target a deployment) |

## Deploying

Use a host with a **persistent disk**, so the SQLite NASA cache survives
restarts: a VPS, Render with a disk, or Railway with a volume.

```bash
npm ci && npm run db:push && npm run build && npm start
BASE_URL=https://your-host npm run warm-cache   # run after every deploy
```

Vercel works, but its filesystem is ephemeral, so the cache is lost and cold
NASA requests can take 10–30 s. For Vercel, switch Prisma to hosted Postgres.
