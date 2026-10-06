# Field Shift — Worklog

NASA Space Apps Challenge — Earth-to-farm decision system.

Architecture (adapted to environment):
- Next.js 16 (App Router) — frontend + API routes (FastAPI role)
- Prisma + SQLite — persistence (PostgreSQL role; only SQLite available)
- NASA POWER live integration (key provided)
- SMAP / GPM / MODIS — fallback/demo data with honest attribution
- Three.js / react-globe.gl — interactive 3D Earth
- shadcn/ui + Tailwind 4 — UI

User flow: Earth → Location → Farmer → NASA observations → Field condition → Crop compatibility → Rotation → Recommendation

---
Task ID: 1
Agent: main
Task: Explore project, plan architecture, install packages, scaffold database schema.

Work Log:
- Inspected Next.js 16 + Prisma + shadcn project at /home/z/my-project
- Confirmed dev server running on :3000
- Decided on tech adaptation: Next.js API routes replace FastAPI; Prisma/SQLite replaces PostgreSQL (only available DB in sandbox)
- Installing three.js + react-globe.gl for holographic Earth
- Defining Prisma schema: farms, farmer_preferences, farmer_crops, crops, field_observations, rotation_plans, rotation_years, nasa_cache

Stage Summary:
- Environment understood; foundation ready.

---
Task ID: 2-a
Agent: globe-builder
Task: Build the Holographic Earth Globe component (`HolographicGlobe.tsx`) — the rotating 3D centerpiece for the Field Shift homepage using react-globe.gl + three.js.

Work Log:
- Read worklog and inspected installed packages: `react-globe.gl@2.38`, `three@0.186`, `@types/three`, Next.js 16, TS 5.
- Studied react-globe.gl typings: `GlobeMethods` (pointOfView, controls, renderer, scene), `GlobeProps` (globeImageUrl, bumpImageUrl, atmosphereColor/Altitude, ringsData, ringColor, htmlElementsData, htmlElement, onGlobeReady), and the `ref` shape (`MutableRefObject<GlobeMethods | undefined>`).
- Confirmed OrbitControls API (@types/three): `autoRotate`, `autoRotateSpeed`, `enableZoom`, `enablePan`, `enableDamping`, `dampingFactor`, `minDistance`, `maxDistance`, `rotateSpeed`, `zoomSpeed`. Noted that OrbitControlsEventMap only declares `change` even though runtime dispatches `start`/`end`, so cast to a loose dispatcher to add those listeners without TS errors.
- Created `/home/z/my-project/src/components/globe/HolographicGlobe.tsx` — a single self-contained client component.
  - Imports only `Globe` (default) and `type { GlobeMethods }` from `react-globe.gl`; all three.js usage stays inside the file so the parent can `dynamic(() => import(...), { ssr:false })`.
  - Props interface exactly as specified: `selectedLat`, `selectedLng`, `locationName`, `onReady`, `size: 'hero' | 'compact'`, `autoRotate`.
  - Named + default export: `export const HolographicGlobe = HolographicGlobeImpl; export default HolographicGlobeImpl;`
  - Earth texture: `//unpkg.com/three-globe/example/img/earth-blue-marble.jpg` (blue-marble day map) + topology bump map (disabled on mobile).
  - Atmosphere: cyan `#22d3ee`, altitude 0.15 — soft, not neon.
  - Transparent background: `backgroundColor="rgba(0,0,0,0)"` so the parent page provides the space/star backdrop.
  - Auto-rotation: `controls.autoRotateSpeed = 0.35` (hero) / `0.15` (compact), paused via OrbitControls `start`/`end` events and resumed after a 2s idle.
  - Zoom: `enableZoom`, `minDistance=180`, `maxDistance=480` (hero) / `360` (compact); `enablePan=false`.
  - Drag-to-rotate handled by globe.gl's built-in OrbitControls.
  - Selected-location marker via `htmlElementsData`: a single amber (`#fbbf24`) dot + Tailwind-free custom `@keyframes hg-marker-ping` pulsing ring (injected via `<style>` tag) + static reticle ring + a 64px vertical amber beam rising from the surface so the marker is visible from any angle.
  - Camera animation: `pointOfView({lat, lng, altitude}, 1000)` triggered by an effect on `[selectedLat, selectedLng, isHero, globeReady]` — altitude 2.2 (hero) / 1.4 (compact).
  - Lat/lng overlay: absolute bottom-left, mono `text-[11px]`, `bg-black/40 backdrop-blur-md`, formatted as `24.3745° N · 88.6042° E`, with optional location name appended.
  - Orbital rings via `ringsData`: 3 rings in hero / 1 ring in compact (and 1 on mobile). `ringColor` returns a `t => rgba(34,211,238, 0.55*(1-t))` function so rings fade as they expand. `ringPropagationSpeed=1.4`, `ringRepeatPeriod=1400`.
  - Mobile detection: `window.innerWidth < 768` reduces ring count and disables the bump map.
  - WebGL fallback: probes `canvas.getContext('webgl')`; if unavailable renders a small mono message ("WebGL not available — showing reduced experience") and never mounts the Globe.
  - Hero vs compact: ring counts, autorotate speed, camera distances and target altitude all branch on `isHero`.
  - Container is `relative h-full w-full overflow-hidden` so the parent controls size and the coordinate overlay can be absolutely positioned. Uses `ResizeObserver` to feed width/height to globe.gl.
- Ran `bun run lint` — 0 errors, 0 warnings.
- Ran `bunx tsc --noEmit --skipLibCheck` — no errors emitted from the new file (only unrelated errors in `examples/` and `skills/` directories).

Stage Summary:
- Produced `/home/z/my-project/src/components/globe/HolographicGlobe.tsx` — a single self-contained client component (343 lines) implementing a textured, atmosphered, auto-rotating Earth with cyan orbital rings, an amber pulsing + beamed marker for the selected location, smooth camera fly-to on selection change, mono coordinate readout overlay, mobile quality reduction, and a WebGL-unavailable fallback.
- Exports both named `HolographicGlobe` and default; fully SSR-safe via `next/dynamic({ ssr:false })`.
- Verified clean: `bun run lint` passes with 0 warnings; tsc finds no errors in the new file.
- Ready for task 2-b to mount this globe on the homepage as the visual centerpiece.

---
Task ID: 3a/3b/3c/5
Agent: main
Task: Build complete backend — crop library, NASA services, decision engine, API routes.

Work Log:
- Built `src/lib/crops.ts` — 15-crop library with agronomic attributes + soil/irrigation types + DB seed.
- Built `src/lib/nasa/cache.ts` — per-source TTL cache in `NasaCache` table.
- Built `src/lib/nasa/power.ts` — LIVE NASA POWER daily + monthly fetch with 10-year trend slopes; uses provided API key.
- Built `src/lib/nasa/smap.ts` — derived soil moisture from POWER (water-balance model) + soil condition; labeled "derived" (honest about SMAP auth).
- Built `src/lib/nasa/gpm.ts` — rainfall stats from POWER PRECTOTCORR (GPM-corrected) with anomaly + variability + dry spells.
- Built `src/lib/nasa/modis.ts` — derived NDVI seasonal model from POWER climatology; labeled "derived" (honest about MODIS auth).
- Built `src/lib/nasa/environment.ts` — orchestrator with stable location-based demo fallback when POWER fails.
- Built `src/lib/decision/engine.ts` — risks + crop compatibility (climate/water/soil/rotation fit, weighted by priorities) + recommendations ("why?" sentences cite specific signals) + 4-year rotation plan.
- Built `src/lib/location.ts` — Open-Meteo geocoding + curated sample farms (Rajshahi, Punjab, Iowa, California Central Valley, Ludhiana, Dhaka).
- API routes: `/api/location`, `/api/crops` (lazy-seeds), `/api/field/analyze` (full DB persistence flow), `/api/field/[id]`, `/api/farms`.
- Lint clean. Dev server still 200 OK on `/`.

Stage Summary:
- Full backend ready: live NASA POWER + derived SMAP/GPM/MODIS + DB persistence + decision engine + sample farms.

---
Task ID: 4-dash
Agent: dashboard-builder
Task: Build the 6 Field Shift dashboard tab panels (Field, Signals, Crops, Planner, Compare, Learn)

Work Log:
- Read worklog + store.ts + Environment/POWER/SMAP/GPM/MODIS/engine.ts to learn the FullAnalysis shape, NASA field shapes, and the analyze API contract.
- Inspected existing field-shift components (DataSourceBadge, HomeScreen, OnboardingWizard, AnalyzingScreen) to mirror the "NASA mission control" visual language and the dynamic-globe import pattern.
- Confirmed available shadcn components and recharts/framer-motion/lucide-react are installed.
- Created `src/components/field-shift/dashboard/FieldOverview.tsx` — Field tab. Profile header (mono "YOUR FIELD" label + h2 location + meta chips for lat/lng/area/soil/irrigation/current/desired). Dynamic HolographicGlobe (size="compact", autoRotate, selectedLat/Lng = field coords) on the left in a 320×280 framed card; 4 information rings on the right (Climate zone, Rainfall zone, Soil zone, Crop region) derived from latitude band / annual rainfall / inferred soil / current crop. "FIELD CONDITION" section with 5 lucide-icon rows + 1-3 word qualitative labels (Thermometer/Droplets/CloudRain/Sprout/Leaf). DataSourceBadge(top-right) + attribution footer line.
- Created `src/components/field-shift/dashboard/SignalsPanel.tsx` — Signals tab. Responsive 1→2 col grid of 4 NASA cards (Temperature, Rainfall, Soil moisture, Vegetation NDVI). Each card has a big-number summary, a stat-row block (current/max, growing-season avg, heat-stress days, anomaly %, variability, dry spells, deficit, 10y trend with up/down arrow), and a chart (LineChart for monthly temp from `rawPower.series`, BarChart for rainfall seasonalPattern, horizontal capacity bar for soil moisture, LineChart for NDVI seasonalPattern). Every card carries a DataSourceBadge(size=sm) and a "Source:" attribution line. Followed by a "Soil condition" full-width card with 6 rows (texture, organic matter, moisture condition, nitrogen balance, erosion risk, water retention) using rose/amber/emerald colored badges, plus an italic disclaimer clarifying which metrics are NASA observation vs derived/model estimate.
- Created `src/components/field-shift/dashboard/CropsPanel.tsx` — Crops tab. Section 1 ("Your crops") uses shadcn Accordion to list `cropCompatibility` rows with 4 mini-fit-bars (Climate/Water/Soil/Rotation) and overallFit big number; expanding reveals reasons as a bulleted list. Section 2 ("What could grow well here?") is a numbered ranked list (01..06) of recommendations with top-4 visual emphasis (bigger amber score) and the "why" sentence. Section 3 ("Change your crops") is a shadcn Dialog triggered by an outline button. The dialog shows selected chips (toggle off), recommended-but-not-selected chips (toggle on), and a full pool. Toggling a chip updates local state and fires a 800ms-debounced POST to `/api/field/analyze` (AbortController-guarded) which calls `setAnalysis(newResult)` + `setView('dashboard')` and shows a sonner toast; an inline "Recalculating..." spinner appears during the request. The store's `inputs` is updated too so future tabs reflect the new desiredCrops.
- Created `src/components/field-shift/dashboard/PlannerPanel.tsx` — Planner tab. Header card with mono "YOUR FIELD SHIFT PLAN" label, big overall score, and 4 score chips (Soil=emerald, Water=cyan, Climate=amber, Income=violet) using `rotationPlan` sub-scores. 4-year timeline: on desktop a horizontal flex with an amber gradient thread underlay + amber ArrowRight between cards; on mobile a vertical stack with rotated ArrowRight separators. Each YearCard shows "YEAR N" mono label, big amber score, crop name, italic cover-crop, irrigation-level badge (rainfed/limited/reliable), and the reason paragraph. Footer card with the rotation rationale in muted italic.
- Created `src/components/field-shift/dashboard/ComparePanel.tsx` — Compare tab. Title + description card. Two side-by-side cards: "CURRENT ROTATION" (rose-tinted, derives Rice→Wheat→Rice→Wheat for rice/wheat fields, otherwise current-crop monoculture, else Fallow) and "FIELD SHIFT PLAN" (amber-tinted, reads `rotationPlan`). Each card stacks its 4 years with crop + score, plus sub-scores + overall. A grouped recharts BarChart compares the 4 sub-scores (Soil/Water/Climate/Income) side-by-side with rose (Current) vs amber (Field Shift) series. Summary card: "Field Shift plan scores X vs current Y — ±N point improvement weighted by your priorities." with the farmer's priority % inline.
- Created `src/components/field-shift/dashboard/LearnPanel.tsx` — Learn tab. Title + transparency paragraph card. shadcn Table of `analysis.sources` (Dataset | Source status | Attribution) with DataSourceBadge in the status cell. "How we score" card lists the 5 sub-scores (Climate fit, Water fit, Soil fit, Rotation fit, Overall fit) with 1-2 sentence descriptions and lucide icons. "Why these data sources" card is a 2-col grid of 4 cards (NASA POWER, NASA SMAP, GPM IMERG, MODIS/VIIRS) explaining what each measures, why Field Shift uses it, and the authentication reality (NSIDC/AppEEARS/GES DISC + POWER-derived substitutes). Footer card with NASA open-data attribution + Space Apps tag.
- Created `src/components/field-shift/dashboard/index.ts` re-exporting all six panels as named exports.
- Ran `bun run lint` — initial run flagged a React-Hooks rules-of-hooks error in CropsPanel (useEffect after early return) + an unused eslint-disable directive. Refactored ChangeCropsSection to declare both useEffects before any early return (guarding null inputs/analysis inside the effect body) and removed the disable comment. Re-ran lint — 0 errors, 0 warnings.
- Ran `bunx tsc --noEmit --skipLibCheck` — no type errors in any dashboard file (remaining tsc errors are pre-existing in `examples/` and `skills/`, unrelated to this task).
- Verified dev.log still shows "✓ Compiled" and 200 responses — no runtime regressions introduced.

Stage Summary:
- Produced 6 panel files + 1 index.ts in `src/components/field-shift/dashboard/`:
  - FieldOverview.tsx (Field tab — globe + 4 info rings + 5-row field condition + attribution)
  - SignalsPanel.tsx (Signals tab — 4 NASA cards with LineChart/BarChart/LineChart + soil-condition section)
  - CropsPanel.tsx (Crops tab — accordion compatibility + ranked recommendations + store-wired change-crops dialog with debounced re-analysis)
  - PlannerPanel.tsx (Planner tab — overall score + 4 score chips + horizontal 4-year timeline + rationale)
  - ComparePanel.tsx (Compare tab — current vs Field Shift side-by-side + grouped BarChart + delta summary)
  - LearnPanel.tsx (Learn tab — sources Table + how-we-score list + 4 data-source cards + NASA attribution footer)
  - index.ts (named re-exports)
- All files are `"use client"`, use the shared `FullAnalysis` type from `@/lib/store`, use `DataSourceBadge` + shadcn Card/Badge/Button/Separator/Accordion/Dialog/Table + recharts + framer-motion + lucide-react.
- Visual language follows the project's "NASA mission control meets precision agriculture" palette: amber-300/400 (primary highlights/recommended), cyan-300/400 (water), emerald-300/400 (good/live), rose-300/400 (risks/current), violet-400 (income). No blue/indigo. Mono labels at `text-[10px] uppercase tracking-widest`.
- Field panel uses dynamically-imported HolographicGlobe (ssr:false) for the compact globe visualization.
- `bun run lint` passes (0 errors, 0 warnings); `tsc --noEmit --skipLibCheck` reports no errors in any dashboard file.
- All panels work at mobile widths (360px) via responsive grids (1 col mobile / 2 col md), stacked year cards, and Dialog full-width fallback.

---
Task ID: 7-12
Agent: main
Task: Build the full frontend (homepage with globe, onboarding, analyzing, dashboard, navigation) and verify end-to-end with Agent Browser.

Work Log:
- Built `DataSourceBadge` with 4 honest states: LIVE / CACHED / DERIVED ESTIMATE / DEMO (added 'derived' for soil moisture + NDVI to match the spec's NASA-observation-vs-derived-estimate requirement).
- Built `LocationSearch` with debounced Open-Meteo geocoding + keyboard navigation.
- Built `HomeScreen` — rotating 3D Earth (dynamic import), "Where is your field?" headline, large search box, quick-pick sample farms, animated "Selected Field" card with "Analyze this area" CTA.
- Built `OnboardingWizard` — 3-step glass panel over a compact globe: (1) crops w/ primary/secondary/considering roles + custom crop input, (2) farm size/units, current crop, irrigation, soil type with "I don't know" inference, (3) priority sliders for soil/water/climate/income with live 100% meter + normalize helper.
- Built `AnalyzingScreen` — globe background + 7-step progress checklist with spinner that ticks the first 5 steps (locate / NASA / rainfall / soil moisture / vegetation) while the parent's fetch resolves; steps 6-7 stay "in progress" until the dashboard swaps in (no false "✓ done" before data is back).
- Built `FieldNavigation` — desktop floating pill + mobile bottom nav with 6 tabs (Field, Signals, Crops, Planner, Compare, Learn) + "FIELD SHIFT" home button.
- Built `FieldDashboard` — tab container with AnimatePresence transitions + sticky footer.
- Built `FieldShiftApp` — top-level state machine driven by Zustand `useAppStore` (home → onboarding → analyzing → dashboard).
- Wired `page.tsx` to render `<FieldShiftApp />`.
- Honesty fixes during verification:
  • Added 'derived' status to DataSourceBadge (LIVE/CACHED/DERIVED/DEMO) — fixes Learn tab crash + lets Soil moisture + NDVI cards honestly say "DERIVED ESTIMATE" instead of falsely "LIVE SMAP".
  • Propagated cache state through Rainfall analysis (gpm.ts) so Temperature AND Rainfall both show CACHED on cache hit.
  • Compare panel now renders cover crops (e.g. "+ Mung / cover crop") in Y4 row.
  • "Change your crops" now commits on Done click (handleDone) — old debounced effect was cancelled by dialog close, so re-analysis was lost. Verified Sorghum appears in the compatibility list after adding it.
- Agent Browser end-to-end verification:
  • Homepage renders with globe + search + sample chips (VLM-confirmed).
  • Rajshahi → globe marker → "Analyze this area" → onboarding 3 steps → Analyze my field → dashboard.
  • Field tab: globe with marker + 4 info rings (Climate/Rainfall/Soil/Crop region) + FIELD CONDITION rows (Temperature/Water/Rainfall/Soil moisture/Vegetation) + LIVE/CACHED badge.
  • Signals tab: 4 NASA cards (Temperature CACHED, Rainfall LIVE/CACHED, Soil moisture DERIVED ESTIMATE, Vegetation DERIVED ESTIMATE) with recharts bar/line + Soil Condition section with honest NASA-observation-vs-derived disclaimer.
  • Crops tab: compatibility accordion (Chickpea 63, Rice 59, Wheat 53) + ranked recommendations with "why" explanations citing data (35% soil-health priority, loamy soil, growing-season mean 29°C).
  • Planner tab: 4-year rotation timeline (Chickpea → Rice → Soybean → Rice+Mung cover) with per-year reasons.
  • Compare tab: Current (Rice↔Wheat) vs Field Shift (Chickpea→Rice→Soybean→Rice+Mung) side-by-side + grouped BarChart of 4 sub-scores + delta summary.
  • Learn tab: sources table with 4 badges + "How we score" + 4 source cards (POWER/SMAP/GPM IMERG/MODIS-VIIRS) honestly explaining auth reality.
  • Mobile (390×844): globe + search + onboarding + dashboard bottom-nav all render correctly.
- `bun run lint` clean (0 errors).
- Dev server still 200 OK; no runtime errors in dev.log.

Stage Summary:
- Field Shift is fully functional end-to-end. Live NASA POWER data flows through FastAPI-style Next.js API routes into a transparent decision engine; SMAP/GPM/MODIS are honestly labeled as DERIVED ESTIMATE (no false "live" claims). 4-year rotation plan adapts to crop changes without restart. Mobile + desktop both work.
