import type { GpmDailySeries, GpmMonthlySeries, DataQuality } from "./gpm";
import type { PowerAnalysis } from "./power";
import type { SoilMoistureAnalysis } from "./smap";
import { getAvailableWaterCapacity } from "./smap";

// ─────────────────────────────────────────────────────────────
// GPM IMERG daily rainfall via the NASA POWER API (IMERG_PRECTOT)
//
// POWER serves IMERG V07 at 0.1° (~10 km) as a point time series, so no
// OPeNDAP / NetCDF decoding is needed.
//   - Final run : from 2001, ~3.5 months behind real time (gauge-calibrated)
//   - Late run  : appended after the Final run, ~14 h latency (NOT gauge-calibrated)
// Daily values are UTC days.
// ─────────────────────────────────────────────────────────────

const POWER_DAILY_URL = "https://power.larc.nasa.gov/api/temporal/daily/point";
const IMERG_PARAM = "IMERG_PRECTOT";
// IMERG_PRECTOT is not listed under every POWER community; try them in order.
const COMMUNITIES = ["AG", "SB", "RE"] as const;
const FINAL_RUN_LAG_DAYS = 110; // ~3.5 months
const REQUEST_TIMEOUT_MS = 20_000;
const MIN_COVERAGE_PCT = 80;
const IMERG_RESOLUTION_LABEL = "0.1° (~10 km, NASA GPM IMERG V07 via NASA POWER)";

function utcMidnight(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDaysUtc(date: Date, days: number): Date {
  const out = new Date(date.getTime());
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

function toCompact(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD
}

type FetchOutcome =
  | { kind: "ok"; json: unknown }
  | { kind: "rejected"; status: number } // 4xx: wrong community/parameter combination
  | { kind: "failed" }; // network error, timeout, 5xx

async function fetchPower(url: string): Promise<FetchOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    // `next.revalidate` is honoured by Next.js (App Router) and ignored elsewhere.
    const res = await fetch(url, { signal: controller.signal, next: { revalidate: 6 * 3600 } } as RequestInit);
    if (res.ok) return { kind: "ok", json: await res.json() };
    if (res.status >= 400 && res.status < 500) return { kind: "rejected", status: res.status };
    return { kind: "failed" };
  } catch {
    return { kind: "failed" };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchGpmRainfallSeries(
  latitude: number,
  longitude: number,
  days = 365,
): Promise<GpmDailySeries | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;

  const windowDays = Math.max(1, Math.floor(days));
  const today = utcMidnight();
  // Stop 2 days back: the newest UTC day can be incomplete.
  const end = addDaysUtc(today, -2);
  const start = addDaysUtc(end, -(windowDays - 1));

  let payload: Record<string, unknown> | null = null;
  let fillValue = -999;

  for (const community of COMMUNITIES) {
    const url =
      `${POWER_DAILY_URL}?parameters=${IMERG_PARAM}&community=${community}` +
      `&longitude=${longitude.toFixed(4)}&latitude=${latitude.toFixed(4)}` +
      `&start=${toCompact(start)}&end=${toCompact(end)}&format=JSON`;

    const outcome = await fetchPower(url);
    if (outcome.kind === "failed") return null; // do not burn 3 x timeout when POWER is down
    if (outcome.kind === "rejected") continue; // try next community

    const json = outcome.json as {
      header?: { fill_value?: number };
      properties?: { parameter?: Record<string, Record<string, number>> };
    };
    const param = json?.properties?.parameter?.[IMERG_PARAM];
    if (param && typeof param === "object") {
      payload = param as Record<string, unknown>;
      if (typeof json.header?.fill_value === "number") fillValue = json.header.fill_value;
      break;
    }
  }

  if (!payload) return null;

  // Build a gap-aware calendar series: a day POWER did not return is NaN (missing),
  // not silently skipped, so coverage is measured against the real calendar.
  const dates: string[] = [];
  const precipitation: number[] = [];
  const finalCutoff = toCompact(addDaysUtc(today, -FINAL_RUN_LAG_DAYS));
  let validDays = 0;
  let provisionalDays = 0;

  for (let i = 0; i < windowDays; i++) {
    const key = toCompact(addDaysUtc(start, i));
    const raw = payload[key];
    const ok = typeof raw === "number" && Number.isFinite(raw) && raw !== fillValue && raw >= 0;
    dates.push(key);
    precipitation.push(ok ? (raw as number) : Number.NaN);
    if (ok) {
      validDays++;
      if (key > finalCutoff) provisionalDays++;
    }
  }

  if (validDays === 0) return null;

  const coveragePct = Math.round((validDays / windowDays) * 1000) / 10;
  const dataQuality: DataQuality = {
    validDays,
    expectedDays: windowDays,
    coveragePct,
    missingDays: windowDays - validDays,
    isReliable: coveragePct >= MIN_COVERAGE_PCT,
    provisionalDays,
  };

  return {
    dates,
    precipitation,
    source: "NASA_GPM_IMERG",
    status: "live",
    product: provisionalDays > 0 ? "IMERG_FINAL_LATE_MIX" : "IMERG_FINAL",
    spatialResolution: IMERG_RESOLUTION_LABEL,
    dataQuality,
  };
}

// Monthly stub kept for call-site compatibility. Derive monthly values from the daily series instead.
export async function fetchGpmMonthlySeries(
  _latitude?: number,
  _longitude?: number,
): Promise<GpmMonthlySeries | null> {
  return null;
}

// ─────────────────────────────────────────────────────────────
// Cross-source agreement (IMERG vs MERRA-2 PRECTOTCORR)
// Two independent estimates of the same rain: when they disagree a lot,
// lower the confidence instead of showing one number as truth.
// Thresholds are heuristics, tune them against local gauge data.
// ─────────────────────────────────────────────────────────────

export interface RainfallAgreement {
  overlapDays: number;
  totalRatio: number | null; // IMERG total / MERRA-2 total over overlapping valid days
  dailyCorrelation: number | null; // Pearson r on overlapping valid days
  level: "good" | "fair" | "poor" | "unknown";
}

export interface DatedSeries {
  dates: string[];
  values: number[];
}

function keyOf(date: string): string {
  return date.replace(/\D/g, "").slice(0, 8);
}

function validRain(v: number | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

export function compareRainfallSources(imerg: DatedSeries, merra: DatedSeries): RainfallAgreement {
  const merraByDate = new Map<string, number>();
  merra.dates.forEach((d, i) => {
    if (validRain(merra.values[i])) merraByDate.set(keyOf(d), merra.values[i]);
  });

  const a: number[] = [];
  const b: number[] = [];
  imerg.dates.forEach((d, i) => {
    const m = merraByDate.get(keyOf(d));
    const v = imerg.values[i];
    if (m !== undefined && validRain(v)) {
      a.push(v);
      b.push(m);
    }
  });

  if (a.length < 14) return { overlapDays: a.length, totalRatio: null, dailyCorrelation: null, level: "unknown" };

  const sumA = a.reduce((x, y) => x + y, 0);
  const sumB = b.reduce((x, y) => x + y, 0);
  const totalRatio = sumB > 0 ? sumA / sumB : null;

  const meanA = sumA / a.length;
  const meanB = sumB / b.length;
  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < a.length; i++) {
    cov += (a[i] - meanA) * (b[i] - meanB);
    varA += (a[i] - meanA) ** 2;
    varB += (b[i] - meanB) ** 2;
  }
  const dailyCorrelation = varA > 0 && varB > 0 ? cov / Math.sqrt(varA * varB) : null;

  let level: RainfallAgreement["level"] = "unknown";
  if (totalRatio !== null && dailyCorrelation !== null) {
    if (totalRatio >= 0.8 && totalRatio <= 1.25 && dailyCorrelation >= 0.5) level = "good";
    else if (totalRatio >= 0.6 && totalRatio <= 1.6 && dailyCorrelation >= 0.3) level = "fair";
    else level = "poor";
  }

  return {
    overlapDays: a.length,
    totalRatio: totalRatio === null ? null : Math.round(totalRatio * 100) / 100,
    dailyCorrelation: dailyCorrelation === null ? null : Math.round(dailyCorrelation * 100) / 100,
    level,
  };
}

// ─────────────────────────────────────────────────────────────
// Root-zone water balance, FAO-56 style.
// Fixes vs. the original smap.ts:
//  1. ET0 actually uses Tmax/Tmin/Rs/RH/wind (the old call passed null for all of them,
//     so it always fell into the "assumed 10 °C diurnal range" branch).
//  2. FAO-56 Penman-Monteith instead of Rs x Δ/(Δ+γ) (which treats Rs as net radiation).
//  3. Water-stress coefficient Ks: ETa falls as the soil dries (old model ran full ETc on dry soil).
//  4. Runoff (SCS-CN) and deep drainage are tracked, so mass balance closes.
//  5. Spin-up period instead of an arbitrary 50 % start inside a 90-day window.
//  6. Stage-based Kc curve instead of one constant Kc.
//  7. POWER fill values (-999) can never leak into GWET* percentages.
// ─────────────────────────────────────────────────────────────

export type Texture = "sandy" | "loamy" | "clay" | "unknown";

// NRCS curve numbers, row crops, good condition: HSG A=67, B=78, C=85, D=89 (assumption: map texture -> HSG).
const DEFAULT_CURVE_NUMBER: Record<Texture, number> = { sandy: 67, loamy: 78, clay: 89, unknown: 80 };
const ASSUMED_DIURNAL_RANGE_C = 10; // only used when neither Tmax/Tmin nor Rs exist
const MISSING_BELOW = -900; // NASA POWER fill value is -999

// ── helpers ──

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > MISSING_BELOW;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const d = value.replace(/\D/g, "");
  if (d.length < 8) return null;
  return new Date(Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8)));
}

function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  return Math.floor((date.getTime() - start) / 86_400_000);
}

const satVapourPressure = (t: number) => 0.6108 * Math.exp((17.27 * t) / (t + 237.3)); // kPa
const vapourPressureSlope = (t: number) => (4098 * satVapourPressure(t)) / Math.pow(t + 237.3, 2); // kPa/°C

function extraterrestrialRadiationMj(latDeg: number, doy: number): number {
  const phi = (latDeg * Math.PI) / 180;
  const dr = 1 + 0.033 * Math.cos((2 * Math.PI * doy) / 365);
  const decl = 0.409 * Math.sin((2 * Math.PI * doy) / 365 - 1.39);
  const ws = Math.acos(clamp(-Math.tan(phi) * Math.tan(decl), -1, 1));
  const ra =
    ((24 * 60) / Math.PI) *
    0.082 *
    dr *
    (ws * Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.sin(ws));
  return Math.max(0, ra); // MJ m-2 day-1
}

// ── ET0: FAO-56 Penman-Monteith ──

export type Et0Method = "fao56-pm" | "fao56-pm-estimated-rs" | "temperature-only";

export interface Et0Inputs {
  tMean: number;
  tMax?: number | null;
  tMin?: number | null;
  rhPct?: number | null; // RH2M (mean)
  windMs2m?: number | null; // WS2M
  solarMjM2?: number | null; // ALLSKY_SFC_SW_DWN, MJ m-2 day-1
  latDeg: number;
  doy: number;
  elevationM?: number;
}

export function referenceEt0(input: Et0Inputs): { et0: number; method: Et0Method } | null {
  if (!isNum(input.tMean)) return null;

  const tMean = input.tMean;
  const z = input.elevationM ?? 0;
  const raMj = extraterrestrialRadiationMj(input.latDeg, input.doy);
  const haveRange = isNum(input.tMax) && isNum(input.tMin) && input.tMax > input.tMin;
  const haveRs = isNum(input.solarMjM2) && input.solarMjM2 > 0;

  let tMax: number;
  let tMin: number;
  if (haveRange) {
    tMax = input.tMax as number;
    tMin = input.tMin as number;
  } else if (haveRs) {
    tMax = tMean;
    tMin = tMean;
  } else {
    tMax = tMean + ASSUMED_DIURNAL_RANGE_C / 2;
    tMin = tMean - ASSUMED_DIURNAL_RANGE_C / 2;
  }

  // Solar radiation: observed if present, else Hargreaves-type estimate (FAO-56 eq. 50, kRs = 0.16).
  const rs = haveRs ? (input.solarMjM2 as number) : 0.16 * Math.sqrt(Math.max(0.5, tMax - tMin)) * raMj;
  const method: Et0Method = haveRs ? "fao56-pm" : haveRange ? "fao56-pm-estimated-rs" : "temperature-only";

  const pressure = 101.3 * Math.pow((293 - 0.0065 * z) / 293, 5.26);
  const gamma = 0.000665 * pressure;
  const es = (satVapourPressure(tMax) + satVapourPressure(tMin)) / 2;
  // Humid-climate assumption when RH is missing: dew point ≈ Tmin.
  const ea = isNum(input.rhPct) ? (clamp(input.rhPct, 1, 100) / 100) * es : satVapourPressure(tMin);

  const rso = (0.75 + 2e-5 * z) * raMj;
  const relRad = rso > 0 ? clamp(rs / rso, 0.3, 1) : 0.5;
  const sigma = 4.903e-9; // MJ K-4 m-2 day-1
  const rnl =
    sigma *
    ((Math.pow(tMax + 273.16, 4) + Math.pow(tMin + 273.16, 4)) / 2) *
    (0.34 - 0.14 * Math.sqrt(Math.max(0, ea))) *
    (1.35 * relRad - 0.35);
  const rn = (1 - 0.23) * rs - rnl;

  const u2 = isNum(input.windMs2m) ? Math.max(0.5, input.windMs2m) : 2.0;
  const delta = vapourPressureSlope(tMean);
  const numerator = 0.408 * delta * rn + gamma * (900 / (tMean + 273)) * u2 * Math.max(0, es - ea);
  const denominator = delta + gamma * (1 + 0.34 * u2);

  return { et0: clamp(numerator / denominator, 0, 12), method };
}

/** Backward-compatible signature. Returns NaN (not an invented 3.0 mm/day) when it cannot compute. */
export function calculateReferenceET0(
  tMean: number,
  tMax: number | null,
  tMin: number | null,
  solarRadMJ: number | null,
  latDeg: number,
  dayOfYearValue: number,
  extras: { rhPct?: number | null; windMs2m?: number | null; elevationM?: number } = {},
): number {
  const r = referenceEt0({ tMean, tMax, tMin, solarMjM2: solarRadMJ, latDeg, doy: dayOfYearValue, ...extras });
  return r ? r.et0 : Number.NaN;
}

// ── Kc curve (FAO-56 single crop coefficient) ──

export interface KcCurve {
  kcIni: number;
  kcMid: number;
  kcEnd: number;
  lIni: number; // stage lengths in days
  lDev: number;
  lMid: number;
  lLate: number;
}

/** ILLUSTRATIVE values; confirm against FAO-56 Tables 11-12 for the crop and variety you model. */
export const EXAMPLE_RICE_CURVE: KcCurve = { kcIni: 1.05, kcMid: 1.2, kcEnd: 0.9, lIni: 30, lDev: 30, lMid: 60, lLate: 30 };

export function kcForDay(curve: KcCurve, dayAfterPlanting: number): number {
  const d = dayAfterPlanting;
  const a = curve.lIni;
  const b = a + curve.lDev;
  const c = b + curve.lMid;
  const e = c + curve.lLate;
  if (d < a) return curve.kcIni;
  if (d < b) return curve.kcIni + ((curve.kcMid - curve.kcIni) * (d - a)) / curve.lDev;
  if (d < c) return curve.kcMid;
  if (d < e) return curve.kcMid + ((curve.kcEnd - curve.kcMid) * (d - c)) / curve.lLate;
  return curve.kcEnd;
}

/** FAO-33 yield response: Ya/Ym = 1 - Ky (1 - ETa/ETc). Ky is crop- and stage-specific. */
export function relativeYieldFromWater(etaMm: number, etcMm: number, ky: number): number | null {
  if (!(etcMm > 0)) return null;
  return clamp(1 - ky * (1 - clamp(etaMm / etcMm, 0, 1)), 0, 1);
}

// ── Water balance ──

export interface DailyWeather {
  dates: string[]; // YYYYMMDD or YYYY-MM-DD
  precipMm: number[];
  tMean: number[];
  tMax?: number[];
  tMin?: number[];
  rhPct?: number[];
  windMs2m?: number[];
  solarMjM2?: number[];
}

export interface WaterBalanceOptions {
  capacityMm: number; // TAW = AWC (mm/m) x rooting depth (m)
  texture: Texture;
  latitude: number;
  elevationM?: number;
  kc?: number | ((dayIndex: number, date: string) => number);
  depletionFraction?: number; // p, fraction of TAW usable before stress starts (default 0.5)
  curveNumber?: number;
  initialFraction?: number; // available water at start of spin-up, 0-1 (default 0.5)
  analysisDays: number; // the last N days are reported; earlier days are spin-up
  irrigationMm?: number[]; // optional, aligned with weather
}

export interface WaterBalanceResult {
  dates: string[];
  availableMm: number[];
  et0: number[];
  etc: number[];
  eta: number[];
  runoff: number[];
  drainage: number[];
  ks: number[];
  validDays: number;
  missingDays: number;
  coveragePct: number;
  isReliable: boolean;
  spinUpDays: number;
  totals: {
    precipMm: number;
    irrigationMm: number;
    runoffMm: number;
    drainageMm: number;
    et0Mm: number;
    etcMm: number;
    etaMm: number;
    unmetDemandMm: number; // sum(ETc - ETa)
    stressDays: number; // days with Ks < 1
  };
  methodCounts: Record<Et0Method, number>;
  /** Should be ~0. Anything larger means the model leaks or invents water. */
  massBalanceErrorMm: number;
}

export function runWaterBalance(weather: DailyWeather, opts: WaterBalanceOptions): WaterBalanceResult {
  const n = weather.dates.length;
  const taw = Math.max(1, opts.capacityMm);
  const raw = clamp(opts.depletionFraction ?? 0.5, 0.1, 0.9) * taw;
  const cn = clamp(opts.curveNumber ?? DEFAULT_CURVE_NUMBER[opts.texture], 30, 98);
  const sRetention = 25400 / cn - 254;
  const ia = 0.2 * sRetention;
  const windowDays = clamp(Math.floor(opts.analysisDays), 1, Math.max(1, n));
  const windowStart = n - windowDays;

  let avail = taw * clamp(opts.initialFraction ?? 0.5, 0, 1);
  let availAtWindowStart = avail;

  const out: WaterBalanceResult = {
    dates: [],
    availableMm: [],
    et0: [],
    etc: [],
    eta: [],
    runoff: [],
    drainage: [],
    ks: [],
    validDays: 0,
    missingDays: 0,
    coveragePct: 0,
    isReliable: false,
    spinUpDays: windowStart,
    totals: { precipMm: 0, irrigationMm: 0, runoffMm: 0, drainageMm: 0, et0Mm: 0, etcMm: 0, etaMm: 0, unmetDemandMm: 0, stressDays: 0 },
    methodCounts: { "fao56-pm": 0, "fao56-pm-estimated-rs": 0, "temperature-only": 0 },
    massBalanceErrorMm: 0,
  };

  for (let i = 0; i < n; i++) {
    const inWindow = i >= windowStart;
    if (i === windowStart) availAtWindowStart = avail;

    const date = weather.dates[i];
    const dateObj = parseDate(date);
    const p = weather.precipMm[i];
    const irrigation = isNum(opts.irrigationMm?.[i]) ? (opts.irrigationMm?.[i] as number) : 0;

    const et0Result =
      dateObj && isNum(p) && p >= 0
        ? referenceEt0({
            tMean: weather.tMean[i],
            tMax: weather.tMax?.[i],
            tMin: weather.tMin?.[i],
            rhPct: weather.rhPct?.[i],
            windMs2m: weather.windMs2m?.[i],
            solarMjM2: weather.solarMjM2?.[i],
            latDeg: opts.latitude,
            doy: dayOfYear(dateObj),
            elevationM: opts.elevationM,
          })
        : null;

    if (!et0Result) {
      // Missing observation: carry the state forward; never treat it as 0 mm rain or a guessed PET.
      if (inWindow) {
        out.missingDays++;
        out.dates.push(date);
        out.availableMm.push(avail);
        out.et0.push(0);
        out.etc.push(0);
        out.eta.push(0);
        out.runoff.push(0);
        out.drainage.push(0);
        out.ks.push(1);
      }
      continue;
    }

    const kc = typeof opts.kc === "function" ? opts.kc(i, date) : (opts.kc ?? 1);

    // SCS-CN runoff
    const runoff = p > ia ? Math.pow(p - ia, 2) / (p + 0.8 * sRetention) : 0;
    const infiltration = p - runoff + irrigation;

    // Water-stress coefficient from start-of-day depletion
    const depletion = taw - avail;
    const ks = depletion <= raw ? 1 : clamp((taw - depletion) / (taw - raw), 0, 1);
    const etc = kc * et0Result.et0;
    const eta = Math.min(ks * etc, avail + infiltration);

    let next = avail + infiltration - eta;
    let drainage = 0;
    if (next > taw) {
      drainage = next - taw;
      next = taw;
    }
    avail = Math.max(0, next);

    if (inWindow) {
      out.validDays++;
      out.dates.push(date);
      out.availableMm.push(avail);
      out.et0.push(et0Result.et0);
      out.etc.push(etc);
      out.eta.push(eta);
      out.runoff.push(runoff);
      out.drainage.push(drainage);
      out.ks.push(ks);
      out.methodCounts[et0Result.method]++;

      const t = out.totals;
      t.precipMm += p;
      t.irrigationMm += irrigation;
      t.runoffMm += runoff;
      t.drainageMm += drainage;
      t.et0Mm += et0Result.et0;
      t.etcMm += etc;
      t.etaMm += eta;
      t.unmetDemandMm += Math.max(0, etc - eta);
      if (ks < 0.999) t.stressDays++;
    }
  }

  out.coveragePct = round1((out.validDays / windowDays) * 100);
  out.isReliable = out.coveragePct >= 80;
  const t = out.totals;
  out.massBalanceErrorMm = availAtWindowStart + t.precipMm + t.irrigationMm - t.runoffMm - t.etaMm - t.drainageMm - avail;
  return out;
}

// ── Safe extraction from PowerAnalysis ──

function pickArray(obj: unknown, ...names: string[]): number[] | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  for (const name of names) {
    const v = (obj as Record<string, unknown>)[name];
    if (Array.isArray(v)) return v as number[];
  }
  return undefined;
}

/** Edit the alias lists to match the field names you used in power.ts. */
export function extractDailyWeather(power: PowerAnalysis): DailyWeather {
  const s = power.series as unknown;
  const dates = (s as { dates?: string[] })?.dates ?? [];
  return {
    dates,
    precipMm: pickArray(s, "prectotcorr") ?? [],
    tMean: pickArray(s, "t2m") ?? [],
    tMax: pickArray(s, "t2mMax", "t2m_max", "T2M_MAX"),
    tMin: pickArray(s, "t2mMin", "t2m_min", "T2M_MIN"),
    rhPct: pickArray(s, "rh2m", "RH2M"),
    windMs2m: pickArray(s, "ws2m", "WS2M", "ws10m", "WS10M"),
    solarMjM2: pickArray(s, "allskySfcSwDwn", "allskySwDwn", "allsky_sfc_sw_dwn", "ALLSKY_SFC_SW_DWN"),
  };
}

/** Last valid 0-1 wetness value within the lookback window, as a percentage. Never returns a fill value. */
export function latestWetnessPct(series: unknown, lookbackDays = 14): number | null {
  if (!Array.isArray(series)) return null;
  for (let i = series.length - 1; i >= Math.max(0, series.length - lookbackDays); i--) {
    const v = series[i];
    if (isNum(v) && v >= 0 && v <= 1) return Math.round(v * 100);
  }
  return null;
}

// ── Drop-in replacement for deriveSoilMoisture() ──

export interface SoilMoistureV2Options {
  soilTexture?: Texture;
  rootingDepthM?: number;
  cropKc?: number;
  kcCurve?: KcCurve;
  plantingDate?: string; // with kcCurve: Kc follows the crop stage
  latitude?: number;
  elevationM?: number;
  irrigationAppliedMm?: number; // total over the window, spread evenly (replace with a daily array if you log it)
  analysisDays?: number;
  spinUpDays?: number; // default 45
  depletionFraction?: number;
  curveNumber?: number;
  initialFraction?: number; // set from SMAP / GWETROOT when available
  /** Preferred rainfall (e.g. IMERG). Missing days fall back to POWER PRECTOTCORR. */
  precipitationOverride?: { dates: string[]; values: number[] };
}

export function deriveSoilMoistureV2(
  power: PowerAnalysis,
  _cropWaterMm = 0, // kept for call-site compatibility; the original never used it either
  options: SoilMoistureV2Options = {},
): SoilMoistureAnalysis {
  const texture = options.soilTexture ?? "unknown";
  const capacity = getAvailableWaterCapacity(texture, options.rootingDepthM ?? 1.0);
  const weather = extractDailyWeather(power);
  const n = weather.dates.length;

  if (!n || !weather.precipMm.length || !weather.tMean.length) {
    return {
      rootZoneWaterMm: 0,
      rootZoneWaterPct: 0,
      rootZoneCapacityMm: capacity,
      // Deprecated aliases still read by decision/engine.ts and SignalsPanel —
      // keep them defined so consumers never see `undefined` / NaN.
      currentMm: 0,
      currentPct: 0,
      referenceEtMmPerDay: 0,
      cropEtMmPerDay: 0,
      totalGrowingSeasonEtcMm: 0,
      seasonalDeficit: 0,
      effectiveRainfallMm: 0,
      rainfallTrendMmPerYear: null,
      soilMoistureTrendPctPerYear: null,
      tenYearTrend: null,
      source: "DEMO",
      status: "unavailable",
      attribution: "No usable NASA POWER daily series.",
      resolution: "0.5° (~50 km derived water balance)",
      dataQuality: { validDays: 0, missingDays: 0, coveragePct: 0, isReliable: false },
    };
  }

  // Rainfall: prefer IMERG where it has a valid day, otherwise MERRA-2.
  let imergDays = 0;
  let merraDays = 0;
  let precip = weather.precipMm;
  if (options.precipitationOverride) {
    const byDate = new Map<string, number>();
    options.precipitationOverride.dates.forEach((d, i) => {
      const v = options.precipitationOverride?.values[i];
      if (isNum(v) && v >= 0) byDate.set(d.replace(/\D/g, "").slice(0, 8), v);
    });
    precip = weather.dates.map((d, i) => {
      const hit = byDate.get(d.replace(/\D/g, "").slice(0, 8));
      if (hit !== undefined) {
        imergDays++;
        return hit;
      }
      if (isNum(weather.precipMm[i]) && weather.precipMm[i] >= 0) merraDays++;
      return weather.precipMm[i];
    });
  }

  const planting = parseDate(options.plantingDate);
  const kc =
    options.kcCurve && planting
      ? (_i: number, date: string) => {
          const d = parseDate(date);
          return kcForDay(options.kcCurve as KcCurve, d ? Math.round((d.getTime() - planting.getTime()) / 86_400_000) : 0);
        }
      : (options.cropKc ?? 1.0);

  const analysisDays = Math.min(n, options.analysisDays ?? 90);
  const spinUp = options.spinUpDays ?? 45;
  const startIndex = Math.max(0, n - analysisDays - spinUp);
  const slice = <T,>(a: T[] | undefined): T[] | undefined => a?.slice(startIndex);

  const windowWeather: DailyWeather = {
    dates: weather.dates.slice(startIndex),
    precipMm: precip.slice(startIndex),
    tMean: weather.tMean.slice(startIndex),
    tMax: slice(weather.tMax),
    tMin: slice(weather.tMin),
    rhPct: slice(weather.rhPct),
    windMs2m: slice(weather.windMs2m),
    solarMjM2: slice(weather.solarMjM2),
  };

  const irrigationPerDay = options.irrigationAppliedMm ? options.irrigationAppliedMm / analysisDays : 0;
  const irrigationMm = irrigationPerDay
    ? windowWeather.dates.map((_, i) => (i >= windowWeather.dates.length - analysisDays ? irrigationPerDay : 0))
    : undefined;

  const wb = runWaterBalance(windowWeather, {
    capacityMm: capacity,
    texture,
    latitude: options.latitude ?? 23.8,
    elevationM: options.elevationM,
    kc,
    depletionFraction: options.depletionFraction,
    curveNumber: options.curveNumber,
    initialFraction: options.initialFraction,
    analysisDays,
    irrigationMm,
  });

  const currentMm = wb.availableMm.length ? wb.availableMm[wb.availableMm.length - 1] : 0;
  const currentPct = clamp((currentMm / capacity) * 100, 0, 100);
  const validDays = Math.max(1, wb.validDays);
  const t = wb.totals;
  // Rain that stayed in the root zone: rain - runoff - deep drainage.
  const effectiveRain = Math.max(0, t.precipMm - t.runoffMm - t.drainageMm);

  const s = power.series as unknown;
  const hasDemo = power.source === "demo";
  const rainNote =
    options.precipitationOverride && imergDays > 0
      ? `Rainfall: GPM IMERG (${imergDays} d) + MERRA-2 gap-fill (${merraDays} d). `
      : "Rainfall: NASA POWER PRECTOTCORR (MERRA-2). ";

  return {
    rootZoneWaterMm: round1(currentMm),
    rootZoneWaterPct: round1(currentPct),
    rootZoneCapacityMm: capacity,
    currentMm: round1(currentMm),
    currentPct: round1(currentPct),

    surfaceSoilWetnessPct: latestWetnessPct(pickArray(s, "gwettop")),
    rootZoneSoilWetnessPct: latestWetnessPct(pickArray(s, "gwetroot")),
    profileSoilWetnessPct: latestWetnessPct(pickArray(s, "gwetprof")),

    referenceEtMmPerDay: round1(t.et0Mm / validDays),
    cropEtMmPerDay: round1(t.etcMm / validDays),
    totalGrowingSeasonEtcMm: round1(t.etcMm),

    // Unmet crop water demand = sum(ETc - ETa); irrigation applied is already counted.
    seasonalDeficit: round1(t.unmetDemandMm),
    effectiveRainfallMm: round1(effectiveRain),

    rainfallTrendMmPerYear: Number.isFinite(power.tenYearRainfallTrend) ? round1(power.tenYearRainfallTrend) : null,
    soilMoistureTrendPctPerYear: null,
    tenYearTrend: null,

    source: hasDemo ? "DEMO" : "DERIVED",
    status: hasDemo ? "unavailable" : "fallback",
    attribution: hasDemo
      ? "Demo estimates (NASA POWER unreachable)."
      : `Derived FAO-56 root-zone water balance (ET0 method: ${dominantMethod(wb.methodCounts)}, ${wb.spinUpDays}-day spin-up). ` +
        rainNote +
        "Not a direct SMAP retrieval; GWET* are MERRA-2 model wetness.",
    resolution: options.precipitationOverride && imergDays > 0 ? "rain 0.1°, meteorology 0.5°" : "0.5° (~50 km derived water balance)",
    dataQuality: {
      validDays: wb.validDays,
      missingDays: wb.missingDays,
      coveragePct: wb.coveragePct,
      isReliable: wb.isReliable,
    },
  };
}

function dominantMethod(counts: Record<Et0Method, number>): Et0Method {
  return (Object.entries(counts) as [Et0Method, number][]).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "temperature-only";
}
