# Task ID: 4-dash — dashboard-builder

## Task
Build the 6 Field Shift dashboard tab panels (Field, Signals, Crops, Planner, Compare, Learn) under `src/components/field-shift/dashboard/`, plus a barrel `index.ts`.

## What I read from previous agents
- `worklog.md` — tasks 1, 2-a, 3a/3b/3c/5 built: globe component, crop library, NASA POWER/SMAP/GPM/MODIS services, decision engine, API routes (`/api/field/analyze`, `/api/field/[id]`, `/api/farms`).
- `src/lib/store.ts` — `FullAnalysis` shape (field, environment, risks, cropCompatibility, recommendations, rotationPlan, sources) + `useAppStore` actions.
- `src/lib/nasa/environment.ts` — `Environment` (temperature, rainfall, soilMoisture, vegetation, overallSource, overallAttribution, rawPower?).
- `src/lib/nasa/power.ts` — `PowerAnalysis.series` shape used by the temperature chart in SignalsPanel.
- `src/lib/nasa/{gpm,smap,modis}.ts` — `RainfallAnalysis.seasonalPattern`, `VegetationAnalysis.seasonalPattern`, `SoilMoistureAnalysis`, `SoilCondition` (used by SignalsPanel soil section).
- `src/lib/decision/engine.ts` — `Risks`, `CropCompatibility`, `Recommendation`, `RotationPlan`/`RotationYear`, `FarmerInputs` (used by CropsPanel dialog).
- `src/components/field-shift/DataSourceBadge.tsx` — `source: 'live'|'cached'|'demo'`, `size: 'sm'|'md'`.
- `src/components/globe/HolographicGlobe.tsx` — props: `selectedLat`, `selectedLng`, `locationName`, `size: 'hero'|'compact'`, `autoRotate`.
- `src/components/field-shift/OnboardingWizard.tsx` — confirmed the analyze POST body shape and that the result is stored via `setAnalysis(json)`.

## Files produced

```
src/components/field-shift/dashboard/
├── FieldOverview.tsx     # Field tab — globe + info rings + field condition
├── SignalsPanel.tsx       # Signals tab — 4 NASA cards + soil section (with recharts charts)
├── CropsPanel.tsx         # Crops tab — accordion + ranked recs + store-wired change-crops dialog
├── PlannerPanel.tsx       # Planner tab — overall score + 4 score chips + 4-year timeline + rationale
├── ComparePanel.tsx       # Compare tab — current vs Field Shift side-by-side + grouped BarChart + summary
├── LearnPanel.tsx         # Learn tab — sources Table + how-we-score + 4 data-source cards + NASA footer
└── index.ts               # named re-exports
```

## Behaviors implemented per panel

### FieldOverview.tsx
- Profile header: `YOUR FIELD` mono label, `<h2>{locationName}</h2>`, meta chips (lat/lng via `formatLatLng`, area, soil, irrigation, current crop, desired crop badges).
- Dynamic `HolographicGlobe` (size="compact", autoRotate, selectedLat/Lng = field coords) on the left.
- 4 information rings on the right: Climate zone (lat band), Rainfall zone (annual rainfall), Soil zone (inferred soil type), Crop region (lat + current crop lookup).
- "FIELD CONDITION" 5-row list (Thermometer/Droplets/CloudRain/Sprout/Leaf) with qualitative labels derived from `risks`/`environment`.
- `DataSourceBadge` (overallSource) at top-right + `overallAttribution` footer.

### SignalsPanel.tsx
- 4 NASA cards in 1→2 col grid:
  - Temperature: current/max/growing-season avg/heat-stress days/10y-trend arrow + monthly LineChart from `rawPower.series`.
  - Rainfall: annual/growing-season/anomaly/variability/dry-spells + monthly BarChart from `rainfall.seasonalPattern`.
  - Soil moisture: current mm + % + seasonal deficit + 10y trend + horizontal capacity bar.
  - Vegetation NDVI: current NDVI + health label + recent trend + monthly LineChart from `vegetation.seasonalPattern`.
- Each card has `DataSourceBadge(size="sm")` and a "Source:" attribution line.
- "Soil condition" full-width card: 6 metric rows with rose/amber/emerald badges + italic disclaimer distinguishing NASA observation vs derived/model estimate.

### CropsPanel.tsx
- "Your crops" — shadcn Accordion of `cropCompatibility` rows; each row shows crop name + 4 mini-fit-bars (Climate/Water/Soil/Rotation) on desktop + big overall number, and expands to reveal `reasons` bullet list.
- "What could grow well here?" — numbered ranked list (01..06) of `recommendations`; top-4 visually emphasized with larger amber score; each shows `why` in muted text.
- "Change your crops" — outline button opens a shadcn Dialog. The dialog shows selected crops as toggle-off chips, recommended-but-not-selected as toggle-on chips, and a full pool. Toggling any chip updates local state and fires a 800ms-debounced POST to `/api/field/analyze` (AbortController-guarded). On success: `setAnalysis(newResult)` + `setView('dashboard')` + sonner success toast; on error: sonner error toast. Inline "Recalculating..." spinner shown during request.

### PlannerPanel.tsx
- Header card with mono `YOUR FIELD SHIFT PLAN` label, big `overallScore`, and 4 score chips (Soil=emerald, Water=cyan, Climate=amber, Income=violet).
- 4-year timeline: desktop horizontal flex with amber gradient underlay + amber `ArrowRight` connectors between cards; mobile vertical stack with rotated ArrowRight. Each year card: `YEAR N` label, big amber score, crop name, italic `with {coverCrop}`, irrigation-level badge, reason paragraph.
- Rationale footer card with muted italic text.

### ComparePanel.tsx
- Title + description.
- Two side-by-side cards: `CURRENT ROTATION` (rose-tinted, derives Rice→Wheat→Rice→Wheat for rice/wheat fields, otherwise current-crop monoculture, else Fallow) vs `FIELD SHIFT PLAN` (amber-tinted, reads `rotationPlan`). Each shows its 4 years + sub-scores + overall.
- Grouped recharts `BarChart` comparing the 4 sub-scores (Soil/Water/Climate/Income) of the two rotations (rose vs amber series), with legend and YAxis 0-100.
- Summary card: "Field Shift plan scores X vs current Y — ±N point improvement/regression weighted by your priorities." plus the farmer's priority % inline.

### LearnPanel.tsx
- Title + transparency paragraph card.
- shadcn `Table` of `analysis.sources` (Dataset | Source status | Attribution) with `DataSourceBadge` in the status cell.
- "How we score" card lists 5 sub-scores (Climate fit, Water fit, Soil fit, Rotation fit, Overall fit) with 1-2 sentence descriptions.
- "Why these data sources" card: 2-col grid of 4 cards (NASA POWER, NASA SMAP, GPM IMERG, MODIS/VIIRS) explaining what each measures, why Field Shift uses it (or derives a substitute), and the authentication reality (NSIDC/AppEEARS/GES DISC + POWER-derived substitutes when Earthdata auth is unavailable).
- Footer card with NASA open-data attribution + Space Apps tag.

## Validation
- `bun run lint` — 0 errors, 0 warnings (after one round of fixes for a React-Hooks rules-of-hooks issue in CropsPanel).
- `bunx tsc --noEmit --skipLibCheck` — no type errors in any dashboard file (remaining tsc errors are pre-existing in `examples/` and `skills/`).
- Dev log shows "✓ Compiled" and 200 responses — no runtime regressions.

## Notes for downstream agents
- The CropsPanel re-analysis flow assumes the `/api/field/analyze` response is a `FullAnalysis`. The previous agent's API route returns `field: { id, ... }` (not `field.farmId` as the `FieldSummary` type expects), but no panel currently consumes `field.farmId`, so this mismatch has no visible effect. If a future agent writes the dashboard wrapper (likely task 4-main or similar), they may want to map `id` → `farmId` when setting `analysis` into the store, or fix the API route to return `farmId`.
- The `signals` panel maps `soilMoisture.source === 'derived'` → `cached` and `vegetation.source === 'derived'` → `cached` so the `DataSourceBadge` (which only accepts live/cached/demo) renders correctly. This is intentional — the underlying sources are POWER-derived estimates, not NASA-direct measurements.
- All panels assume `analysis.environment.rawPower` may be undefined (demo path) and gracefully omit the temperature line chart in that case.
