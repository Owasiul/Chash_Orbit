// Chash Orbit — Vegetation (NDVI) service
// LIVE: NASA MODIS MOD13Q1 (Terra, 250 m, 16-day NDVI composites) via the
// public ORNL DAAC MODIS/VIIRS Land Product Subsets REST API — no Earthdata
// login required. Docs: https://modis.ornl.gov/data/modis_webservice.html
// Area-window support: queries multi-pixel subset sized to polygon extent.
// FALLBACK: when the subset service is slow or unreachable, a seasonal NDVI
// model driven by NASA POWER climatology with South Asian regional bias correction,
// clearly labeled "derived".

import type { PowerAnalysis } from './power';
import { getCached, setCached, CACHE_TTL, type CacheKey } from './cache';

export interface NdviObservation {
  date: string;                 // 'YYYY-MM-DD' (composite start date)
  ndvi: number;                 // -0.2..1
}

export interface VegetationAnalysis {
  ndvi: number;                 // 0..1 — observed (live) or estimated (derived/demo)
  health: 'poor' | 'moderate' | 'good' | 'vigorous';
  // `ndvi` is the value shown for the month (observed when live, else model);
  // `model` is always the POWER-driven model, so the UI can compare the two.
  seasonalPattern: { month: string; ndvi: number | null; model: number }[];
  observations?: NdviObservation[];
  observedDate?: string;        // date of the most recent MODIS composite used
  recentTrend: number;          // NDVI change per year
  source: 'live' | 'cached' | 'derived' | 'demo';
  attribution: string;
  resolution?: string;          // e.g. "250 m (MODIS Terra MOD13Q1)"
  areaWindowKm?: number;        // total bounding window size in km
  ndviLoading?: boolean;        // true when background MODIS fetch is still acquiring
  sentinel2SceneId?: string | null; // optional STAC reference
  sentinel2Date?: string | null;
  sentinel2CloudCover?: number | null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ── Live MODIS NDVI (ORNL DAAC) ─────────────────────────────────────────────
const ORNL_BASE = 'https://modis.ornl.gov/rst/api/v1/MOD13Q1';
const NDVI_BAND = '250m_16_days_NDVI';
const NDVI_SCALE = 0.0001;
const COMPOSITES_PER_YEAR = 23;
const MAX_COMPOSITES_PER_REQUEST = 10; // enforced by the ORNL service
const BACKGROUND_TIMEOUT_MS = 60_000;  // max duration for background ORNL fetch

export interface ModisNdviResult {
  observations: NdviObservation[];
  source: 'live' | 'cached';
  areaWindowKm?: number;
}

/**
 * Calculates area window (km above/below and left/right) from polygon coordinates.
 * Returns 0 if field is smallholder / single-pixel scale (< ~25 ha).
 */
export function computePolygonKmWindow(polygon?: [number, number][] | { coordinates?: [number, number][] }): { kmAboveBelow: number; kmLeftRight: number; totalWindowKm: number } {
  const coords: [number, number][] | undefined = Array.isArray(polygon)
    ? polygon
    : Array.isArray(polygon?.coordinates)
      ? polygon.coordinates
      : undefined;
  if (!coords || coords.length < 3) return { kmAboveBelow: 0, kmLeftRight: 0, totalWindowKm: 0.25 };
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  for (const [lng, lat] of coords) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  const deltaLat = maxLat - minLat;
  const deltaLng = maxLng - minLng;
  const avgLat = (minLat + maxLat) / 2;
  const heightKm = deltaLat * 111;
  const widthKm = deltaLng * 111 * Math.cos((avgLat * Math.PI) / 180);

  // If smaller than 500m across, single 250m pixel is appropriate
  const kmAboveBelow = Math.min(10, Math.max(0, Math.round(heightKm / 2)));
  const kmLeftRight = Math.min(10, Math.max(0, Math.round(widthKm / 2)));
  const totalWindowKm = Math.max(0.25, Math.max(kmAboveBelow * 2, kmLeftRight * 2));
  return { kmAboveBelow, kmLeftRight, totalWindowKm };
}

async function fetchWithRetry(url: string, timeoutMs: number, retries = 2, backoffMs = 800): Promise<Response> {
  let attempt = 0;
  while (true) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
        cache: 'no-store',
      });
      if (res.ok) return res;
      if ([429, 500, 502, 503, 504].includes(res.status) && attempt < retries) {
        attempt++;
        await new Promise(r => setTimeout(r, backoffMs * 2 ** (attempt - 1)));
        continue;
      }
      return res;
    } catch (err) {
      if (attempt < retries) {
        attempt++;
        await new Promise(r => setTimeout(r, backoffMs * 2 ** (attempt - 1)));
        continue;
      }
      throw err;
    }
  }
}

async function ornlJson<T>(path: string, timeoutMs: number): Promise<T> {
  const res = await fetchWithRetry(`${ORNL_BASE}/${path}`, timeoutMs, 2, 800);
  if (!res.ok) throw new Error(`ORNL MODIS HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function fetchModisNdviLive(
  lat: number,
  lng: number,
  kmAboveBelow = 0,
  kmLeftRight = 0,
): Promise<NdviObservation[]> {
  const point = `latitude=${lat}&longitude=${lng}`;
  const { dates } = await ornlJson<{ dates: { modis_date: string; calendar_date: string }[] }>(
    `dates?${point}`,
    BACKGROUND_TIMEOUT_MS,
  );
  const lastYear = dates.slice(-COMPOSITES_PER_YEAR);
  const chunks: (typeof lastYear)[] = [];
  for (let i = 0; i < lastYear.length; i += MAX_COMPOSITES_PER_REQUEST) {
    chunks.push(lastYear.slice(i, i + MAX_COMPOSITES_PER_REQUEST));
  }
  const subsets = await Promise.all(
    chunks.map(c =>
      ornlJson<{ subset: { calendar_date: string; data: number[] }[] }>(
        `subset?${point}&band=${NDVI_BAND}&startDate=${c[0].modis_date}&endDate=${c[c.length - 1].modis_date}&kmAboveBelow=${kmAboveBelow}&kmLeftRight=${kmLeftRight}`,
        BACKGROUND_TIMEOUT_MS,
      ),
    ),
  );
  return subsets
    .flatMap(s => s.subset)
    .map(row => {
      // -3000 is the MOD13Q1 fill value; valid range is -2000..10000
      const valid = row.data.filter(r => typeof r === 'number' && r >= -2000 && r <= 10000);
      const meanRaw = valid.length ? valid.reduce((s, v) => s + v, 0) / valid.length : null;
      return { date: row.calendar_date, raw: meanRaw };
    })
    .filter((r): r is { date: string; raw: number } => r.raw !== null)
    .map(r => ({ date: r.date, ndvi: Math.round(r.raw * NDVI_SCALE * 1000) / 1000 }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// One background fetch per location + window, shared by concurrent requests.
const inflight = new Map<string, Promise<NdviObservation[] | null>>();

export function isModisInflight(lat: number, lng: number): boolean {
  const flightKeyPrefix = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  for (const key of inflight.keys()) {
    if (key.includes(flightKeyPrefix)) return true;
  }
  return false;
}

function modisCacheKey(lat: number, lng: number, kmAboveBelow = 0, kmLeftRight = 0): CacheKey {
  const now = new Date();
  const month = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  return {
    source: 'modis',
    latitude: lat,
    longitude: lng,
    dateRange: month,
    parameters: `MOD13Q1:${NDVI_BAND}:${kmAboveBelow}x${kmLeftRight}`,
  };
}

/**
 * Returns the last year of MODIS NDVI for a point / polygon window, or null if it isn't
 * available within `budgetMs`. A slow fetch keeps running in the background
 * and fills the cache, so the next request gets live data immediately.
 */
export async function getModisNdvi(
  lat: number,
  lng: number,
  polygon?: [number, number][],
  budgetMs = 4000,
): Promise<ModisNdviResult | null> {
  const { kmAboveBelow, kmLeftRight, totalWindowKm } = computePolygonKmWindow(polygon);
  const key = modisCacheKey(lat, lng, kmAboveBelow, kmLeftRight);
  const cached = await getCached<NdviObservation[]>(key, CACHE_TTL.MODIS).catch(() => null);
  if (cached && cached.data.length) {
    return { observations: cached.data, source: 'cached', areaWindowKm: totalWindowKm };
  }

  const flightKey = `${key.dateRange}:${lat.toFixed(2)},${lng.toFixed(2)}:${kmAboveBelow}x${kmLeftRight}`;
  let job = inflight.get(flightKey);
  if (!job) {
    job = fetchModisNdviLive(lat, lng, kmAboveBelow, kmLeftRight)
      .then(async obs => {
        if (obs.length) await setCached(key, obs, CACHE_TTL.MODIS).catch(() => {});
        return obs.length ? obs : null;
      })
      .catch((err) => {
        console.warn('[MODIS] Background fetch error:', err.message);
        return null;
      })
      .finally(() => inflight.delete(flightKey));
    inflight.set(flightKey, job);
  }

  const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), budgetMs));
  const obs = await Promise.race([job, timeout]);
  return obs ? { observations: obs, source: 'live', areaWindowKm: totalWindowKm } : null;
}

// ── South Asia regional bias correction ────────────────────────────────────
// The uncorrected temperature+precipitation model runs 0.24-0.36 NDVI too high
// in South Asia due to missed cropping calendars, dry season fallows, and bare soil.
// We apply a calibrated regional adjustment of -0.28 inside South Asia [lat 6°-37°N, lng 68°-98°E].
export function isSouthAsia(lat: number, lng: number): boolean {
  return lat >= 6 && lat <= 37 && lng >= 68 && lng <= 98;
}

export function applyRegionalBias(rawNdvi: number, lat: number, lng: number): number {
  if (isSouthAsia(lat, lng)) {
    return Math.max(0.05, Math.min(0.85, Math.round((rawNdvi - 0.28) * 100) / 100));
  }
  return rawNdvi;
}

// ── Derived seasonal NDVI model (fallback + comparison) ────────────────────
export function seasonalModel(power: PowerAnalysis, lat?: number, lng?: number): number[] {
  const s = power.series;
  const byMonth: Record<string, { p: number; t: number; c: number }> = {};
  for (let i = 0; i < s.dates.length; i++) {
    const m = s.dates[i].slice(4, 6);
    const p = s.prectotcorr[i];
    const t = s.t2m[i];
    byMonth[m] ||= { p: 0, t: 0, c: 0 };
    if (!Number.isNaN(p)) byMonth[m].p += p;
    if (!Number.isNaN(t)) { byMonth[m].t += t; byMonth[m].c++; }
  }
  return MONTHS.map((_, idx) => {
    const mm = String(idx + 1).padStart(2, '0');
    const b = byMonth[mm] || { p: 0, t: 0, c: 0 };
    const tAvg = b.c ? b.t / b.c : 20;
    // rainfall term: 100mm/month -> ~+0.25 NDVI
    // temperature term: 25°C optimal, drops at <10 or >35
    const rainTerm = Math.min(0.3, b.p / 400);
    const tTerm = Math.max(0, 1 - Math.abs(tAvg - 25) / 25);
    const rawNdvi = Math.max(0.05, Math.min(0.85, 0.15 + rainTerm + 0.4 * tTerm));
    const corrected = (lat != null && lng != null) ? applyRegionalBias(rawNdvi, lat, lng) : rawNdvi;
    return Math.round(corrected * 100) / 100;
  });
}

function healthOf(ndvi: number): VegetationAnalysis['health'] {
  return ndvi >= 0.65 ? 'vigorous' : ndvi >= 0.45 ? 'good' : ndvi >= 0.25 ? 'moderate' : 'poor';
}

function median(a: number[]): number {
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Least-squares NDVI slope, expressed per year.
function slopePerYear(obs: NdviObservation[]): number {
  if (obs.length < 2) return 0;
  const xs = obs.map(o => Date.parse(o.date) / (365.25 * 86_400_000));
  const mx = xs.reduce((s, x) => s + x, 0) / xs.length;
  const my = obs.reduce((s, o) => s + o.ndvi, 0) / obs.length;
  let num = 0, den = 0;
  obs.forEach((o, i) => { num += (xs[i] - mx) * (o.ndvi - my); den += (xs[i] - mx) ** 2; });
  return den === 0 ? 0 : num / den;
}

export function deriveVegetation(
  power: PowerAnalysis,
  lat: number,
  lng: number,
  modis: ModisNdviResult | null = null,
  polygon?: [number, number][],
  sentinel?: { sceneId: string; datetime?: string; cloudCoverPct?: number } | null,
): VegetationAnalysis {
  const model = seasonalModel(power, lat, lng);
  const { totalWindowKm } = computePolygonKmWindow(polygon);

  if (modis && modis.observations.length) {
    const obs = modis.observations;
    const byMonth: Record<number, number[]> = {};
    for (const o of obs) (byMonth[Number(o.date.slice(5, 7)) - 1] ||= []).push(o.ndvi);
    // Median of the last 3 composites (~48 days) damps single-scene cloud noise.
    const current = Math.round(median(obs.slice(-3).map(o => o.ndvi)) * 100) / 100;
    return {
      ndvi: current,
      health: healthOf(current),
      seasonalPattern: MONTHS.map((month, i) => ({
        month,
        ndvi: byMonth[i] ? Math.round((byMonth[i].reduce((s, v) => s + v, 0) / byMonth[i].length) * 100) / 100 : null,
        model: model[i],
      })),
      observations: obs,
      observedDate: obs[obs.length - 1].date,
      recentTrend: Math.round(slopePerYear(obs) * 1000) / 1000,
      source: modis.source,
      attribution: 'NASA MODIS Terra MOD13Q1 (250 m, 16-day NDVI) via ORNL DAAC Land Product Subsets.',
      resolution: '250 m (NASA MODIS Terra MOD13Q1)',
      areaWindowKm: modis.areaWindowKm ?? totalWindowKm,
      ndviLoading: false,
      sentinel2SceneId: sentinel?.sceneId ?? null,
      sentinel2Date: sentinel?.datetime ?? null,
      sentinel2CloudCover: sentinel?.cloudCoverPct ?? null,
    };
  }

  const isDemo = power.source === 'demo' || Number.isNaN(power.annualRainfall);
  const current = model[new Date().getUTCMonth()] ?? 0.3;
  const inflightActive = isModisInflight(lat, lng);

  return {
    ndvi: current,
    health: healthOf(current),
    seasonalPattern: MONTHS.map((month, i) => ({ month, ndvi: model[i], model: model[i] })),
    recentTrend: isDemo ? 0 : Math.round(power.tenYearRainfallTrend * 0.001 * 1000) / 1000,
    source: isDemo ? 'demo' : 'derived',
    attribution: isDemo
      ? 'Demo estimate (NASA POWER unreachable). Values are illustrative.'
      : 'Derived estimate from NASA POWER precipitation and temperature with South Asian regional bias correction (live MODIS NDVI acquiring in background).',
    resolution: '0.5° (~50 km derived climatology)',
    areaWindowKm: totalWindowKm,
    ndviLoading: inflightActive,
    sentinel2SceneId: sentinel?.sceneId ?? null,
    sentinel2Date: sentinel?.datetime ?? null,
    sentinel2CloudCover: sentinel?.cloudCoverPct ?? null,
  };
}
