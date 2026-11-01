// Chash Orbit — NASA POWER extras (all unauthenticated, same API as power.ts)
//
//  1. Root-zone / surface soil wetness (GWETROOT, GWETTOP). These are MERRA-2
//     reanalysis fields that POWER mirrors, so they are NASA *modelled* soil
//     moisture on a ~0.5° x 0.625° grid. They are NOT SMAP retrievals and the
//     UI must say so.
//  2. A real rainfall baseline: the last 365 days are compared with the
//     10-year mean for the same calendar months, instead of a latitude-band
//     guess.
//  3. Standard extreme-rainfall indices (Rx5day, heavy-rain days, longest dry
//     run) computed from the daily series that is already fetched.
//
// fetchPowerExtras never throws; any part that fails comes back as null.

import type { PowerDailySeries } from './power';

const POWER_BASE = 'https://power.larc.nasa.gov/api/temporal';
const NASA_API_KEY = process.env.NASA_API_KEY;

// ── Types ───────────────────────────────────────────────────────────────────
export interface SoilWetnessAnalysis {
  /** 0 (dry) .. 1 (saturated); mean of the last 7 valid days */
  rootNow: number | null;
  topNow: number | null;
  root90dMean: number | null;
  /** 10-year mean root-zone wetness for the calendar month of the latest day */
  rootNormal: number | null;
  /** (rootNow - rootNormal) / rootNormal * 100 */
  rootAnomalyPct: number | null;
  /** 10-year normal per calendar month (index 0 = Jan) */
  monthlyNormal: (number | null)[];
  resolutionNote: string;
}

export interface RainBaseline {
  windowMm: number;
  expectedMm: number;
  /** trailing-365-day anomaly vs POWER 10-year normals, % */
  anomalyPct: number | null;
  last90Mm: number;
  expected90Mm: number;
  anomaly90Pct: number | null;
  /** 10-year normal in mm per calendar month (index 0 = Jan) */
  monthlyNormalMm: (number | null)[];
  yearsUsed: number;
}

export interface RainExtremes {
  /** wettest 5-day total, mm */
  rx5dayMm: number;
  /** days >= 20 mm */
  heavyDays20: number;
  /** days >= 50 mm */
  heavyDays50: number;
  /** longest run of days with < 1 mm */
  maxConsecutiveDryDays: number;
  wetDays: number;
}

export interface PowerExtras {
  soilWetness: SoilWetnessAnalysis | null;
  rainBaseline: RainBaseline | null;
  extremes: RainExtremes | null;
  source: 'live';
  attribution: string;
}

// ── HTTP ────────────────────────────────────────────────────────────────────
type Raw = { properties?: { parameter?: Record<string, Record<string, number | null>> } };
type ParamBlock = Record<string, number | null>;

const ok = (v: number | null | undefined): v is number =>
  v != null && v !== -999 && Number.isFinite(v);

async function getPower(
  temporal: 'daily' | 'monthly',
  latitude: number,
  longitude: number,
  start: string,
  end: string,
  parameters: string,
): Promise<Raw> {
  const url =
    `${POWER_BASE}/${temporal}/point?parameters=${parameters}&community=AG` +
    `&longitude=${longitude}&latitude=${latitude}&start=${start}&end=${end}&format=JSON`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (NASA_API_KEY) headers['X-Api-Key'] = NASA_API_KEY;
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`POWER ${temporal} HTTP ${res.status}`);
  return (await res.json()) as Raw;
}

function ymd(d: Date): string {
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}${m}${day}`;
}

// ── Pure helpers (exported so they can be unit-tested) ──────────────────────
const mean = (a: number[]): number | null => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);

/** Mean of a monthly POWER parameter per calendar month across all years. */
export function monthlyNormals(block: ParamBlock | undefined): (number | null)[] {
  const sums = Array.from({ length: 12 }, () => ({ s: 0, n: 0 }));
  for (const [key, v] of Object.entries(block ?? {})) {
    if (!/^\d{4}(0[1-9]|1[0-2])$/.test(key)) continue; // skips YYYY13 (annual)
    if (!ok(v)) continue;
    const m = parseInt(key.slice(4, 6), 10) - 1;
    sums[m].s += v;
    sums[m].n += 1;
  }
  return sums.map(x => (x.n ? x.s / x.n : null));
}

/**
 * Compare observed rainfall (daily series) with the 10-year same-month normal.
 * `normalMmPerDay[m]` is the POWER monthly PRECTOTCORR mean (mm/day), m = 0..11.
 * Working per day makes partial first/last months safe.
 */
export function buildRainBaseline(
  prec: number[],
  dates: string[],
  normalMmPerDay: (number | null)[],
  yearsUsed: number,
): RainBaseline | null {
  const n = Math.min(prec.length, dates.length);
  if (n === 0) return null;

  const tally = (from: number) => {
    let observed = 0;
    let expected = 0;
    for (let i = from; i < n; i++) {
      const v = prec[i];
      const m = parseInt(dates[i].slice(4, 6), 10) - 1;
      const normal = normalMmPerDay[m];
      if (!ok(v) || normal == null) continue;
      observed += v;
      expected += normal;
    }
    return { observed, expected };
  };

  const year = tally(0);
  const q = tally(Math.max(0, n - 90));
  const pct = (o: number, e: number) => (e > 0 ? ((o - e) / e) * 100 : null);

  // Monthly normal in mm (days in an average month) for charting.
  const dim = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return {
    windowMm: round1(year.observed),
    expectedMm: round1(year.expected),
    anomalyPct: pct(year.observed, year.expected),
    last90Mm: round1(q.observed),
    expected90Mm: round1(q.expected),
    anomaly90Pct: pct(q.observed, q.expected),
    monthlyNormalMm: normalMmPerDay.map((v, i) => (v == null ? null : round1(v * dim[i]))),
    yearsUsed,
  };
}

export function computeExtremes(prec: number[]): RainExtremes | null {
  if (!prec.length) return null;
  let rx5 = 0;
  for (let i = 0; i + 5 <= prec.length; i++) {
    let s = 0;
    let bad = false;
    for (let j = i; j < i + 5; j++) {
      if (!ok(prec[j])) { bad = true; break; }
      s += prec[j];
    }
    if (!bad && s > rx5) rx5 = s;
  }
  let heavy20 = 0, heavy50 = 0, wet = 0, run = 0, maxRun = 0;
  for (const v of prec) {
    if (!ok(v)) { run = 0; continue; }
    if (v >= 20) heavy20++;
    if (v >= 50) heavy50++;
    if (v >= 1) { wet++; run = 0; } else { run++; if (run > maxRun) maxRun = run; }
  }
  return {
    rx5dayMm: round1(rx5),
    heavyDays20: heavy20,
    heavyDays50: heavy50,
    maxConsecutiveDryDays: maxRun,
    wetDays: wet,
  };
}

export function buildSoilWetness(
  rootDaily: ParamBlock,
  topDaily: ParamBlock,
  rootMonthlyNormal: (number | null)[],
): SoilWetnessAnalysis | null {
  const dates = Object.keys(rootDaily).filter(k => /^\d{8}$/.test(k)).sort();
  const rootVals = dates.map(d => rootDaily[d]).filter(ok);
  if (!rootVals.length) return null;

  const topDates = Object.keys(topDaily).filter(k => /^\d{8}$/.test(k)).sort();
  const topVals = topDates.map(d => topDaily[d]).filter(ok);

  const last = (a: number[], n: number) => a.slice(Math.max(0, a.length - n));
  const rootNow = mean(last(rootVals, 7));
  const lastValidDate = dates.filter(d => ok(rootDaily[d])).pop()!;
  const m = parseInt(lastValidDate.slice(4, 6), 10) - 1;
  const rootNormal = rootMonthlyNormal[m] ?? null;

  return {
    rootNow: rootNow == null ? null : round3(rootNow),
    topNow: topVals.length ? round3(mean(last(topVals, 7))!) : null,
    root90dMean: round3(mean(last(rootVals, 90))!),
    rootNormal: rootNormal == null ? null : round3(rootNormal),
    rootAnomalyPct:
      rootNow != null && rootNormal != null && rootNormal > 0
        ? Math.round(((rootNow - rootNormal) / rootNormal) * 100)
        : null,
    monthlyNormal: rootMonthlyNormal.map(v => (v == null ? null : round3(v))),
    resolutionNote:
      'MERRA-2 reanalysis (~50 km grid) served through NASA POWER. Modelled soil wetness, not a SMAP retrieval.',
  };
}

function round1(v: number) { return Math.round(v * 10) / 10; }
function round3(v: number) { return Math.round(v * 1000) / 1000; }

// ── Public API ──────────────────────────────────────────────────────────────
export async function fetchPowerExtras(
  latitude: number,
  longitude: number,
  series: PowerDailySeries,
): Promise<PowerExtras | null> {
  const now = new Date();
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 364);
  const lastFull = now.getUTCFullYear() - 1;
  const yStart = lastFull - 9;

  const [monthly, daily] = await Promise.allSettled([
    getPower('monthly', latitude, longitude, String(yStart), String(lastFull), 'PRECTOTCORR,GWETROOT'),
    getPower('daily', latitude, longitude, ymd(start), ymd(now), 'GWETROOT,GWETTOP'),
  ]);

  const mp = monthly.status === 'fulfilled' ? monthly.value.properties?.parameter : undefined;
  const dp = daily.status === 'fulfilled' ? daily.value.properties?.parameter : undefined;

  const precNormal = mp ? monthlyNormals(mp.PRECTOTCORR) : null;
  const rootNormal = mp ? monthlyNormals(mp.GWETROOT) : Array.from({ length: 12 }, () => null);

  const rainBaseline = precNormal
    ? buildRainBaseline(series.prectotcorr, series.dates, precNormal, 10)
    : null;
  const extremes = computeExtremes(series.prectotcorr);
  const soilWetness = dp?.GWETROOT
    ? buildSoilWetness(dp.GWETROOT, dp.GWETTOP ?? {}, rootNormal)
    : null;

  if (!rainBaseline && !extremes && !soilWetness) return null;

  return {
    soilWetness,
    rainBaseline,
    extremes,
    source: 'live',
    attribution:
      'NASA POWER: PRECTOTCORR 10-year same-month normals, GWETROOT/GWETTOP (MERRA-2 soil wetness), ' +
      'extreme-rain indices from the daily series.',
  };
}
