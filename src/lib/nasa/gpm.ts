import type { PowerAnalysis } from "./power";
import { getCached, setCached, CACHE_TTL } from "./cache";

export type DataSource =
  | "NASA_POWER"
  | "NASA_GPM_IMERG"
  | "NASA_SMAP"
  | "NASA_MODIS"
  | "DERIVED"
  | "DEMO";

export type DataStatus = "live" | "cached" | "fallback" | "unavailable";

export interface DataQuality {
  validDays: number;
  expectedDays: number;
  coveragePct: number;
  missingDays: number;
  isReliable: boolean;
}

export interface GpmDailySeries {
  dates: string[];
  precipitation: number[];
  source: DataSource;
  status: DataStatus;
  product: "IMERG_FINAL" | "IMERG_LATE" | "POWER_PRECTOTCORR" | "DEMO";
  spatialResolution: string;
  dataQuality: DataQuality;
}

export interface GpmMonthlySeries {
  months: string[]; // YYYYMM
  precipitation: number[]; // mm/day-equivalent monthly mean from NASA POWER PRECTOTCORR
  source: DataSource;
  status: DataStatus;
  product: "POWER_PRECTOTCORR";
}

export interface ImergCheck {
  days: number;
  imergMm: number;
  powerMm: number;
  /** (IMERG - POWER) / POWER, in percent. */
  differencePct: number | null;
  product: string;
}

export interface RainfallAnalysis {
  /** Independent satellite check of POWER rainfall over the most recent weeks. */
  imergCheck?: ImergCheck | null;
  annualRainfall: number;
  growingSeasonRainfall: number;
  growingSeasonDays: number;
  growingSeasonLabel: string;

  // Anomaly is null when no valid location-specific historical baseline exists
  anomalyPct: number | null;
  anomalyBasis?: "location-historical" | "power-10yr";

  variability: number;
  monthlyVariability: number;
  coefficientOfVariationPct: number;

  drySpells: number;
  maxConsecutiveDryDays: number;

  seasonalPattern: {
    month: string;
    mm: number;
  }[];

  // Specific, unmixed trend metrics
  rainfallTrendMmPerYear: number | null;
  recentTrend: number | null;
  trendSource?: string;

  source: DataSource;
  status: DataStatus;
  attribution: string;
  resolution?: string;
  dataQuality: DataQuality;
}

export interface DeriveRainfallOptions {
  /** Location-specific historical annual rainfall (mm). Used for the anomaly when provided. */
  historicalBaselineMm?: number | null;
  /** If both dates are valid, the growing season is [plantingDate, harvestDate]. */
  cropCalendar?: {
    cropName?: string;
    plantingDate?: string; // YYYYMMDD or YYYY-MM-DD
    harvestDate?: string; // YYYYMMDD or YYYY-MM-DD
  };
  /** Growing-season window length (days) when no crop calendar is given. Default: 90. */
  customAnalysisDays?: number;
  /** Minimum % of valid days for the data to be flagged reliable. Default: 80. */
  minimumCoveragePct?: number;
}

// ─────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────

// GPM_3IMERGDF.07 is the Final daily product. GES DISC has moved to
// Earthdata Cloud OPeNDAP; do not use the retired gpm1.gesdisc host or
// invent a /point endpoint. A proper NetCDF/OPeNDAP subset adapter is needed
// to decode the gridded file into one location's daily series.
// NASA POWER (PRECTOTCORR) is the fallback, returned separately and never labelled IMERG.

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

const DEFAULT_GROWING_SEASON_DAYS = 90;
const DEFAULT_MIN_COVERAGE_PCT = 80;
const DRY_DAY_THRESHOLD_MM = 1;
const POWER_RESOLUTION_LABEL = "~0.5° (~50 km, NASA POWER / MERRA-2)";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

// Rainfall can never be negative, so this also rejects fill values such as -999.
function isValidRain(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function validValues(values: number[] | undefined | null): number[] {
  return (values ?? []).filter(isValidRain);
}

function sumValues(values: number[] | undefined | null): number {
  return validValues(values).reduce((acc, value) => acc + value, 0);
}

function mean(values: number[] | undefined | null): number {
  const arr = validValues(values);
  return arr.length ? arr.reduce((acc, value) => acc + value, 0) / arr.length : 0;
}

function stdDev(values: number[] | undefined | null): number {
  const arr = validValues(values);
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((acc, value) => acc + (value - m) ** 2, 0) / arr.length);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

// "2025-03-14" or "20250314" -> 20250314 (comparable as a number)
function toYyyymmdd(value: string | undefined): number | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 8) return null;
  const parsed = Number.parseInt(digits.slice(0, 8), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Average monthly rainfall (mm) per calendar month.
 * Totals are summed per (month, year) first, then averaged across the years
 * present, so a multi-year series is not inflated by summing every year together.
 * `hasData` is false for months with no valid observation at all.
 */
function buildSeasonalPattern(
  dates: string[],
  values: number[],
): { month: string; mm: number; hasData: boolean }[] {
  const totals = new Map<number, Map<string, number>>();
  const len = Math.min(dates.length, values.length);

  for (let i = 0; i < len; i++) {
    const value = values[i];
    if (!isValidRain(value)) continue;

    const digits = dates[i].replace(/\D/g, "");
    if (digits.length < 6) continue;

    const year = digits.slice(0, 4);
    const monthIndex = Number.parseInt(digits.slice(4, 6), 10) - 1;
    if (!Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) continue;

    const perYear = totals.get(monthIndex) ?? new Map<string, number>();
    perYear.set(year, (perYear.get(year) ?? 0) + value);
    totals.set(monthIndex, perYear);
  }

  return MONTH_NAMES.map((month, monthIndex) => {
    const perYear = totals.get(monthIndex);
    if (!perYear || perYear.size === 0) return { month, mm: 0, hasData: false };
    const yearlyTotals = Array.from(perYear.values());
    const avg = yearlyTotals.reduce((acc, v) => acc + v, 0) / yearlyTotals.length;
    return { month, mm: round1(avg), hasData: true };
  });
}

/**
 * Picks the growing-season values:
 *  1. crop calendar window (planting -> harvest) if valid and present in the series
 *  2. otherwise the last `customAnalysisDays` days (default 90)
 */
function selectGrowingSeason(
  dates: string[],
  values: number[],
  options: DeriveRainfallOptions,
): number[] {
  const planting = toYyyymmdd(options.cropCalendar?.plantingDate);
  const harvest = toYyyymmdd(options.cropCalendar?.harvestDate);

  if (planting !== null && harvest !== null && harvest >= planting) {
    const inSeason: number[] = [];
    const len = Math.min(dates.length, values.length);
    for (let i = 0; i < len; i++) {
      const day = toYyyymmdd(dates[i]);
      if (day !== null && day >= planting && day <= harvest) inSeason.push(values[i]);
    }
    if (inSeason.length > 0) return inSeason;
  }

  const requested = options.customAnalysisDays;
  const windowDays =
    typeof requested === "number" && Number.isFinite(requested) && requested >= 1
      ? Math.floor(requested)
      : DEFAULT_GROWING_SEASON_DAYS;

  return values.slice(Math.max(0, values.length - windowDays));
}

// ─────────────────────────────────────────────
// Data fetchers
// ─────────────────────────────────────────────

// IMERG Late daily (GPM_3IMERGDL v07, 0.1 degree) through NASA's cloud OPeNDAP, using the
// server-side Earthdata token. Returns null when the token is missing or any step fails,
// and callers keep using NASA POWER.
const IMERG_LATE_COLLECTION = "C2723754859-GES_DISC";
const IMERG_CONCURRENCY = 8;

function imergCell(latitude: number, longitude: number): { i: number; j: number } {
  const i = Math.min(3599, Math.max(0, Math.floor((longitude + 180) / 0.1)));
  const j = Math.min(1799, Math.max(0, Math.floor((latitude + 90) / 0.1)));
  return { i, j };
}

/** Pulls the single value out of an OPeNDAP .csv point response. */
export function parseImergPoint(text: string): number {
  const m = text.match(/precipitation\[[^\]]*\]\[[^\]]*\],\s*(-?\d+(?:\.\d+)?)/);
  if (!m) return NaN;
  const v = Number(m[1]);
  return Number.isFinite(v) && v > -999 ? v : NaN;
}

export async function fetchGpmRainfallSeries(
  latitude: number,
  longitude: number,
  days = 30,
): Promise<GpmDailySeries | null> {
  const token = process.env.EARTHDATA_TOKEN?.trim();
  if (!token) return null;

  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);
  const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
  const key = { source: "gpm-imerg-late", latitude, longitude, dateRange: `${ymd(start)}-${ymd(end)}`, parameters: "precipitation" };
  const cached = await getCached<GpmDailySeries>(key, CACHE_TTL.GPM).catch(() => null);
  if (cached) return { ...cached.data, status: "cached" };

  try {
    // One CMR query lists the granules that exist, so file-name versions never have to be guessed.
    const cmr = await fetch(
      `https://cmr.earthdata.nasa.gov/search/granules.json?short_name=GPM_3IMERGDL&version=07&temporal=${start.toISOString().slice(0, 10)}T00:00:00Z,${end.toISOString().slice(0, 10)}T23:59:59Z&page_size=${days + 5}&sort_key=start_date`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (!cmr.ok) return null;
    const entries = ((await cmr.json()) as { feed?: { entry?: { title: string; links: { href: string }[] }[] } }).feed?.entry ?? [];
    const granules = entries
      .map((e) => ({
        date: e.title.match(/\.(\d{8})-S/)?.[1] ?? "",
        url: e.links.map((l) => l.href).find((h) => h.startsWith(`https://opendap.earthdata.nasa.gov/collections/${IMERG_LATE_COLLECTION}/`)),
      }))
      .filter((g): g is { date: string; url: string } => !!g.date && !!g.url);
    if (!granules.length) return null;

    const { i, j } = imergCell(latitude, longitude);
    const ce = encodeURIComponent(`precipitation[0][${i}][${j}]`);
    const values: number[] = new Array(granules.length).fill(NaN);
    let next = 0;
    const worker = async () => {
      while (next < granules.length) {
        const idx = next++;
        try {
          const r = await fetch(`${granules[idx].url}.csv?${ce}`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(15000),
          });
          if (r.ok) values[idx] = parseImergPoint(await r.text());
        } catch {
          // leave NaN; coverage reflects it
        }
      }
    };
    await Promise.all(Array.from({ length: IMERG_CONCURRENCY }, worker));

    const valid = values.filter((v) => Number.isFinite(v)).length;
    if (valid < Math.max(5, granules.length * 0.5)) return null;
    const series: GpmDailySeries = {
      dates: granules.map((g) => g.date),
      precipitation: values,
      source: "NASA_GPM_IMERG",
      status: "live",
      product: "IMERG_LATE",
      spatialResolution: "0.1° (~10 km) GPM IMERG Late daily",
      dataQuality: {
        validDays: valid,
        expectedDays: granules.length,
        coveragePct: Math.round((valid / granules.length) * 1000) / 10,
        missingDays: granules.length - valid,
        isReliable: valid / granules.length >= 0.8,
      },
    };
    await setCached(key, series, CACHE_TTL.GPM).catch(() => {});
    return series;
  } catch {
    return null;
  }
}

/** Compares IMERG with POWER rainfall on the days both have data. */
export function compareImergToPower(gpm: GpmDailySeries, power: PowerAnalysis): ImergCheck | null {
  const byDate = new Map(power.series.dates.map((d, k) => [d, power.series.prectotcorr[k]] as const));
  let imerg = 0;
  let pw = 0;
  let n = 0;
  gpm.dates.forEach((d, k) => {
    const a = gpm.precipitation[k];
    const b = byDate.get(d);
    if (Number.isFinite(a) && b !== undefined && Number.isFinite(b)) {
      imerg += a;
      pw += b;
      n++;
    }
  });
  if (n < 5) return null;
  return {
    days: n,
    imergMm: round1(imerg),
    powerMm: round1(pw),
    differencePct: pw > 0 ? round1(((imerg - pw) / pw) * 100) : null,
    product: "GPM IMERG Late v07 (0.1°)",
  };
}

// Stub: same as above for monthly data.
export async function fetchGpmMonthlySeries(
  _latitude: number,
  _longitude: number,
): Promise<GpmMonthlySeries | null> {
  return null;
}

// ─────────────────────────────────────────────
// Analysis
// ─────────────────────────────────────────────

export function deriveRainfall(
  power: PowerAnalysis,
  _latitude: number, // kept so existing callers don't break; not needed by the current logic
  anomalyPct: number | null = null,
  gpmData?: GpmDailySeries | null,
  options: DeriveRainfallOptions = {},
): RainfallAnalysis {
  // Use GPM only if it actually contains valid data, so the source label always
  // matches the numbers that were really used.
  const gpm = gpmData && validValues(gpmData.precipitation).length > 0 ? gpmData : null;

  const dates = gpm ? gpm.dates : power.series.dates;
  const series = gpm ? gpm.precipitation : power.series.prectotcorr;
  const source: DataSource = gpm ? gpm.source : "NASA_POWER";
  const status: DataStatus = gpm ? gpm.status : "fallback";

  // ── Totals ──
  const annualRainfall = sumValues(series);

  // ── Growing season ──
  const growingSeason = selectGrowingSeason(dates, series, options);
  const growingSeasonRainfall = sumValues(growingSeason);
  const growingSeasonDays = growingSeason.length;
  const validSeasonDays = validValues(growingSeason).length;

  // Thresholds were designed for a 90-day window, so normalise to 90 days.
  const per90Days =
    validSeasonDays > 0 ? (growingSeasonRainfall / validSeasonDays) * DEFAULT_GROWING_SEASON_DAYS : 0;
  const growingSeasonLabel =
    validSeasonDays === 0 ? "Unknown" : per90Days < 150 ? "Dry" : per90Days < 350 ? "Moderate" : "Wet";

  // ── Dry days (missing data is NOT a dry day; it breaks the run) ──
  let dryRun = 0;
  let maxConsecutiveDryDays = 0;
  for (const value of growingSeason) {
    if (!isValidRain(value)) {
      dryRun = 0;
    } else if (value < DRY_DAY_THRESHOLD_MM) {
      dryRun += 1;
      maxConsecutiveDryDays = Math.max(maxConsecutiveDryDays, dryRun);
    } else {
      dryRun = 0;
    }
  }

  // ── Variability ──
  const variability = stdDev(series);
  const seasonal = buildSeasonalPattern(dates, series);
  const monthlyVariability = stdDev(seasonal.filter((entry) => entry.hasData).map((entry) => entry.mm));
  const meanRain = mean(series); // mean of valid days only
  const coefficientOfVariationPct = meanRain > 0 ? (variability / meanRain) * 100 : 0;

  // ── Trend (always from NASA POWER, so it is labelled that way) ──
  const trendMmPerYear = Number.isFinite(power.tenYearRainfallTrend) ? power.tenYearRainfallTrend : null;

  // ── Data quality ──
  const minimumCoveragePct = clamp(options.minimumCoveragePct ?? DEFAULT_MIN_COVERAGE_PCT, 0, 100);
  const expectedDays = Math.max(1, series.length);
  const validDays = validValues(series).length;
  const coveragePct = clamp((validDays / expectedDays) * 100, 0, 100);
  const computedQuality: DataQuality = {
    validDays,
    expectedDays,
    coveragePct: round1(coveragePct),
    missingDays: Math.max(0, expectedDays - validDays),
    isReliable: validDays > 0 && coveragePct >= minimumCoveragePct,
  };

  // ── Anomaly ──
  // Priority: explicit anomalyPct > historicalBaselineMm > POWER baseline (only when
  // GPM data is used; comparing POWER with itself would always give ~0%).
  let resolvedAnomaly: number | null = null;
  let anomalyBasis: RainfallAnalysis["anomalyBasis"];

  const baselineMm = options.historicalBaselineMm;
  if (anomalyPct != null && Number.isFinite(anomalyPct)) {
    resolvedAnomaly = anomalyPct;
    anomalyBasis = "location-historical";
  } else if (typeof baselineMm === "number" && Number.isFinite(baselineMm) && baselineMm > 0) {
    resolvedAnomaly = ((annualRainfall - baselineMm) / baselineMm) * 100;
    anomalyBasis = "location-historical";
  } else if (gpm && Number.isFinite(power.annualRainfall) && power.annualRainfall > 0) {
    // Assumes power.annualRainfall is the NASA POWER baseline for this location.
    resolvedAnomaly = ((annualRainfall - power.annualRainfall) / power.annualRainfall) * 100;
    anomalyBasis = "power-10yr";
  }

  const attribution =
    source === "NASA_GPM_IMERG"
      ? "GPM IMERG Final daily precipitation; trend and baseline reference from NASA POWER PRECTOTCORR."
      : "NASA POWER PRECTOTCORR daily precipitation (fallback; GPM IMERG not available for this location).";

  return {
    annualRainfall: round1(annualRainfall),
    growingSeasonRainfall: round1(growingSeasonRainfall),
    growingSeasonDays,
    growingSeasonLabel,
    anomalyPct: resolvedAnomaly === null ? null : round1(resolvedAnomaly),
    anomalyBasis: resolvedAnomaly === null ? undefined : anomalyBasis,
    variability: round1(variability),
    monthlyVariability: round1(monthlyVariability),
    coefficientOfVariationPct: round1(coefficientOfVariationPct),
    drySpells: power.drySpells,
    maxConsecutiveDryDays,
    seasonalPattern: seasonal.map(({ month, mm }) => ({ month, mm })),
    rainfallTrendMmPerYear: trendMmPerYear == null ? null : round1(trendMmPerYear),
    // No real recent-window trend is available, so don't fabricate one.
    recentTrend: null,
    trendSource: "NASA POWER 10-year trend",
    source,
    status,
    attribution,
    resolution: gpm?.spatialResolution ?? POWER_RESOLUTION_LABEL,
    dataQuality: gpm?.dataQuality ?? computedQuality,
  };
}

export async function getRainfallSummary(
  power: PowerAnalysis,
  latitude: number,
  longitude: number,
  anomalyPct: number | null = null,
  options: DeriveRainfallOptions = {},
): Promise<RainfallAnalysis> {
  const gpmData = await fetchGpmRainfallSeries(latitude, longitude, 365).catch((error: unknown) => {
    console.warn("GPM IMERG fetch failed, falling back to NASA POWER:", error);
    return null;
  });
  return deriveRainfall(power, latitude, anomalyPct, gpmData, options);
}