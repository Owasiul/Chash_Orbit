// Field Shift — Vegetation (NDVI) service
// LIVE: NASA MODIS MOD13Q1 (Terra, 250 m, 16-day NDVI composites) via the
// public ORNL DAAC MODIS/VIIRS Land Product Subsets REST API — no Earthdata
// login required. Docs: https://modis.ornl.gov/data/modis_webservice.html
// FALLBACK: when the subset service is slow or unreachable, a seasonal NDVI
// model driven by NASA POWER climatology, clearly labeled "derived".

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
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ── Live MODIS NDVI (ORNL DAAC) ─────────────────────────────────────────────
const ORNL_BASE = 'https://modis.ornl.gov/rst/api/v1/MOD13Q1';
const NDVI_BAND = '250m_16_days_NDVI';
const NDVI_SCALE = 0.0001;
const COMPOSITES_PER_YEAR = 23;
const MAX_COMPOSITES_PER_REQUEST = 10; // enforced by the ORNL service
const BACKGROUND_TIMEOUT_MS = 90_000;  // a 10-composite chunk can take ~30s

export interface ModisNdviResult {
  observations: NdviObservation[];
  source: 'live' | 'cached';
}

async function ornlJson<T>(path: string, timeoutMs: number): Promise<T> {
  const res = await fetch(`${ORNL_BASE}/${path}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`ORNL MODIS HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function fetchModisNdviLive(lat: number, lng: number): Promise<NdviObservation[]> {
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
        `subset?${point}&band=${NDVI_BAND}&startDate=${c[0].modis_date}&endDate=${c[c.length - 1].modis_date}&kmAboveBelow=0&kmLeftRight=0`,
        BACKGROUND_TIMEOUT_MS,
      ),
    ),
  );
  return subsets
    .flatMap(s => s.subset)
    .map(row => ({ date: row.calendar_date, raw: row.data[0] }))
    // -3000 is the MOD13Q1 fill value; valid range is -2000..10000
    .filter(r => typeof r.raw === 'number' && r.raw >= -2000 && r.raw <= 10000)
    .map(r => ({ date: r.date, ndvi: Math.round(r.raw * NDVI_SCALE * 1000) / 1000 }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// One background fetch per location, shared by concurrent requests.
const inflight = new Map<string, Promise<NdviObservation[] | null>>();

function modisCacheKey(lat: number, lng: number): CacheKey {
  // Monthly key: new composites only arrive every 16 days, so reuse across days.
  const now = new Date();
  const month = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  return { source: 'modis', latitude: lat, longitude: lng, dateRange: month, parameters: `MOD13Q1:${NDVI_BAND}` };
}

/**
 * Returns the last year of MODIS NDVI for a point, or null if it isn't
 * available within `budgetMs`. A slow fetch keeps running in the background
 * and fills the cache, so the next request for the same field gets live data.
 */
export async function getModisNdvi(lat: number, lng: number, budgetMs = 12_000): Promise<ModisNdviResult | null> {
  const key = modisCacheKey(lat, lng);
  const cached = await getCached<NdviObservation[]>(key, CACHE_TTL.MODIS).catch(() => null);
  if (cached && cached.data.length) return { observations: cached.data, source: 'cached' };

  const flightKey = `${key.dateRange}:${lat.toFixed(2)},${lng.toFixed(2)}`;
  let job = inflight.get(flightKey);
  if (!job) {
    job = fetchModisNdviLive(lat, lng)
      .then(async obs => {
        if (obs.length) await setCached(key, obs, CACHE_TTL.MODIS).catch(() => {});
        return obs.length ? obs : null;
      })
      .catch(() => null)
      .finally(() => inflight.delete(flightKey));
    inflight.set(flightKey, job);
  }

  const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), budgetMs));
  const obs = await Promise.race([job, timeout]);
  return obs ? { observations: obs, source: 'live' } : null;
}

// ── Derived seasonal NDVI model (fallback + comparison) ────────────────────
// NDVI rises with summer warmth and rainfall, dips in cold or dry months. We
// approximate monthly NDVI from rainfall + temperature normals and clamp to
// [0.05, 0.85].
function seasonalModel(power: PowerAnalysis): number[] {
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
    const ndvi = Math.max(0.05, Math.min(0.85, 0.15 + rainTerm + 0.4 * tTerm));
    return Math.round(ndvi * 100) / 100;
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
  modis: ModisNdviResult | null = null,
): VegetationAnalysis {
  const model = seasonalModel(power);

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
      attribution: 'NASA MODIS Terra MOD13Q1 (250 m, 16-day NDVI) via ORNL DAAC MODIS/VIIRS Land Product Subsets.',
    };
  }

  const isDemo = power.source === 'demo' || Number.isNaN(power.annualRainfall);
  const current = model[new Date().getUTCMonth()] ?? 0.3;
  return {
    ndvi: current,
    health: healthOf(current),
    seasonalPattern: MONTHS.map((month, i) => ({ month, ndvi: model[i], model: model[i] })),
    // Tie trend to rainfall trend (positive rainfall -> rising NDVI); illustrative.
    recentTrend: isDemo ? 0 : Math.round(power.tenYearRainfallTrend * 0.001 * 1000) / 1000,
    source: isDemo ? 'demo' : 'derived',
    attribution: isDemo
      ? 'Demo estimate (NASA POWER unreachable). Values are illustrative.'
      : 'Derived estimate from NASA POWER precipitation and temperature climatology (live MODIS NDVI was not available in time).',
  };
}
