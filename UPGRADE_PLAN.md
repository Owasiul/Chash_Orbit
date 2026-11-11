# TASK: Upgrade Chash Orbit into a single-page, polygon-based "Earth-to-farm" decision tool

Repo: Owasiul/Chash_Orbit (Next.js App Router, React, TypeScript, Tailwind, shadcn/ui, Prisma, Zustand, recharts, Vercel AI SDK + Gemini).
Reference for the polygon-map idea only (do NOT copy code): alinausova/nasa-space-apps-2025-home-grown (satellite map + polygon drawing -> NASA POWER climate -> crop recommendations -> AI summary).

## RULES (read first, follow strictly)
1. Before changing anything, read the existing code: `src/lib/decision/engine.ts`, `src/lib/crops.ts`, the NASA fetch code (POWER, MODIS/ORNL), the API routes, the Zustand store, the Prisma schema, and the main page. Summarize the current data flow in 10 lines before editing.
2. Do NOT invent APIs, endpoints, parameters, package names or versions. For every external API or library, check its official documentation (or the installed package's types in node_modules) before using it. If you cannot verify something, say so and use the simplest verified alternative.
3. Keep the deterministic decision engine as the single source of truth for scores and rankings. The LLM may only explain engine output and must never produce numbers.
4. Keep the source-label system (LIVE / CACHED / DERIVED / DEMO). Never label a modeled value as a measurement.
5. Make small, working steps. After each phase: `npm run lint` and `npm run build` must pass. Do not leave dead code, TODOs without a reason, or scratch files.
6. If a requirement is impossible or ambiguous, state the assumption in the final summary instead of guessing silently.

## PHASE 0: Repo cleanup
- Delete all root-level `scratch*.{js,mjs}` and `test-*.mjs` files. If any contain useful checks, convert them to real tests under `tests/`.
- Remove `AGENTS.md` and `CLAUDE.md` only if they contain no project documentation needed by the README.
- Resolve the database inconsistency: README says SQLite, repo topics and the live deployment use Vercel + Neon/Postgres. Use Postgres (Neon) for the NASA response cache and saved analyses, update `prisma/schema.prisma`, `.env.example`, README, and scripts accordingly. Add a cache TTL.
- Add a GitHub Actions workflow: install, lint, test, build.
- Add unit tests (Vitest or the project's existing runner) for `engine.ts`: scoring bounds 0-100, priority weighting, rotation never repeats a crop family in consecutive years, legume/cereal alternation, cover-crop rule when soil-health priority is high.

## PHASE 1: Google Earth-like polygon map (replace or complement the globe)
Goal: the user sees satellite imagery, zooms to a field, and draws a polygon around it.
- Use a map library with satellite imagery and 3D-globe/terrain support. Preferred: MapLibre GL JS with a free satellite raster source (verify the provider's terms of use and attribution requirements; if a token-free option is not acceptable, use Mapbox GL JS with `NEXT_PUBLIC_MAPBOX_TOKEN` in `.env.example`).
- Use a drawing library that officially supports the chosen map library (e.g. Terra Draw with its MapLibre/Mapbox adapter; verify in its docs). Support: draw polygon, edit vertices, delete, and one active polygon at a time.
- Use Turf.js for area (hectares), centroid, and bounding box. Show area live while drawing.
- Keep: place search, a one-click demo (Rajshahi, Bangladesh rice farm) that loads a preset polygon, and the existing globe intro only if it does not slow the page; otherwise remove it.
- Validate the polygon: minimum area, maximum area (e.g. reject > 5,000 ha with a clear message), self-intersection check.
- Mobile-friendly: drawing must work on touch screens.

## PHASE 2: Polygon-aware NASA data (be honest about resolution)
- NASA POWER is a coarse grid. Use the polygon centroid (or the few grid cells under the polygon, if the API supports it, after verifying) and say in the UI which resolution was used.
- MODIS NDVI: query the ORNL DAAC subset for the polygon centroid with an area window sized to the polygon, only if the verified API supports it; otherwise centroid only. Show the resolution (250 m) in the UI.
- STRETCH (only if time remains and verified): Sentinel-2 L2A NDVI for the polygon (10 m) via Microsoft Planetary Computer STAC. Compute server-side, cache the result, label it LIVE (Sentinel-2, not NASA). Do not block the page on it.
- Cache by rounded centroid + date range. Add timeouts, retries with backoff, and a graceful fallback to DEMO labeled values.
- Run data fetches in parallel and stream/progressively render results; show a skeleton or progress per data source. The first MODIS request can take ~30 s, so show "NDVI loading" without blocking the rest.
- Fix the known issue: the POWER-only NDVI model runs 0.24-0.36 too high in South Asia. Make live MODIS (or Sentinel-2) the primary NDVI. Keep the model only as a labeled DERIVED fallback, with a simple regional bias correction documented in the code and README.

## PHASE 3: Everything on ONE page (no tabs, no route changes)
Single scrolling dashboard with a sticky top bar. Layout:
1. Map (full width on mobile, left ~55% on desktop, sticky) with drawing tools and area readout.
2. Farmer profile form (compact, collapsible): current crop, candidate crops, irrigation, soil or "I don't know", priorities (soil, water, climate, income).
3. "Analyze" button -> results appear below/right on the same page in this order:
   a. Verdict card: one sentence, e.g. "Plant X next, then Y; main risk: Z." (generated from engine output)
   b. Ranked crops with score, 4 fit sub-scores, and a "why" citing the data
   c. 4-year rotation timeline
   d. Climate and risk panel: heat, drought, flood, rainfall, NDVI chart (observed vs modeled), each with a source badge
   e. Scenario sliders (e.g. -20% rainfall, +2 C) that re-run the deterministic engine instantly and show rank changes
   f. AI Field Report + "Ask your field" chat (collapsible, grounded in the engine JSON only)
   g. Data sources, resolution, and limitations
4. Export button: print-friendly one-page PDF/plan of the verdict, ranking, rotation, and sources (use browser print CSS if no library is installed; do not add heavy dependencies without need).

## PHASE 4: Trust and clarity
- Show a data-quality indicator and a confidence note per recommendation (based on data source labels and resolution).
- Calibrate or at least cite sources for the crop library (`crops.ts`): add a `source` field per crop value (e.g. BARI/BRRI/FAO) only where you can verify the value; otherwise mark it `illustrative`. Do not make up citations.
- Add Bangla language toggle for UI strings and the AI advisor (i18n with a simple dictionary; advisor prompt specifies reply language).
- AI advisor: pass the engine output as structured JSON; instruct the model to cite only values in that JSON; add rate limiting on the chat endpoint and basic input length limits.
- Optional validation: if `data/` contains or can load the UCI crop-mapping dataset (id 525), add a small offline script that reports how often recommendations agree with observed crops, and put the single resulting number in the README. If it cannot be done honestly, skip it and say so.

## PHASE 5: Docs and demo
- README: screenshot/GIF at top, live link, "How this solves Field Shift" mapped to features, architecture diagram, data-source table with resolution and status, limitations, setup (Postgres, env vars), scripts.
- Add `npm run warm-cache` for demo polygons and make the demo load in under ~10 s.

## DEFINITION OF DONE
- Draw a polygon on satellite imagery, press Analyze, see all outputs on one page.
- Lint, build, and tests pass in CI; no scratch/test files in root.
- Every number has a source badge; no LLM-generated numbers.
- Final message from you lists: files changed, new env vars, assumptions, anything unverified or skipped.