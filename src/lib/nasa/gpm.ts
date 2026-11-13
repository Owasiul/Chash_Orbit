import type { PowerAnalysis } from "./power";
import {
  fetchGpmRainfallSeries,
  fetchGpmMonthlySeries,
  compareRainfallSources,
  type RainfallAgreement,
} from "./gpm-imerg";

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
  provisionalDays?: number;
}

export interface GpmDailySeries {
  dates: string[];
  precipitation: number[];
  source: DataSource;
  status: DataStatus;
  product: "IMERG_FINAL" | "IMERG_FINAL_LATE_MIX" | "POWER_PRECTOTCORR" | "DEMO";
  spatialResolution: string;
  dataQuality: DataQuality;
  agreement?: RainfallAgreement;
}

export interface GpmMonthlySeries {
  months: string[]; // YYYYMM
  precipitation: number[]; // mm/day-equivalent monthly mean from NASA POWER PRECTOTCORR
  source: DataSource;
  status: DataStatus;
  product: "POWER_PRECTOTCORR";
}

export interface RainfallAnalysis {
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
  agreement?: RainfallAgreement;
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

function countDrySpells(values: number[]): number {
  let run = 0;
  let spells = 0;

  for (const value of values) {
    if (!isValidRain(value)) {
      run = 0;
      continue;
    }

    if (value < DRY_DAY_THRESHOLD_MM) {
      run++;
    } else {
      if (run >= 3) spells++;
      run = 0;
    }
  }

  if (run >= 3) spells++;

  return spells;
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

// Stub: returns null until an OPeNDAP / NetCDF subset adapter for IMERG is written.
// Callers fall back to NASA POWER.
export {
  fetchGpmRainfallSeries,
  fetchGpmMonthlySeries,
  compareRainfallSources,
  type RainfallAgreement,
};



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
  const source: DataSource = gpm
    ? gpm.source
    : power.source === "demo"
      ? "DEMO"
      : "NASA_POWER";

  const status: DataStatus = gpm
    ? gpm.status
    : power.source === "live"
      ? "fallback"
      : power.source === "cached"
        ? "cached"
        : "fallback";

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
  // Never compare two current-period totals and call them a climatological anomaly.
  let resolvedAnomaly: number | null = null;
  let anomalyBasis: RainfallAnalysis["anomalyBasis"];

  const baselineMm = options.historicalBaselineMm;
  if (anomalyPct != null && Number.isFinite(anomalyPct)) {
    resolvedAnomaly = anomalyPct;
    anomalyBasis = "location-historical";
  } else if (
    typeof baselineMm === "number" &&
    Number.isFinite(baselineMm) &&
    baselineMm > 0 &&
    computedQuality.isReliable
  ) {
    resolvedAnomaly =
      ((annualRainfall - baselineMm) / baselineMm) * 100;
    anomalyBasis = "location-historical";
  }

  const attribution = gpm
    ? "NASA GPM IMERG Final daily precipitation."
    : power.source === "demo"
      ? "Demonstration rainfall data; not a live NASA observation."
      : "NASA POWER PRECTOTCORR daily precipitation. GPM IMERG direct retrieval is not connected.";

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
    drySpells: countDrySpells(growingSeason),
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
    agreement: gpm && power.series?.dates?.length ? compareRainfallSources({ dates: gpm.dates, values: gpm.precipitation }, { dates: power.series.dates, values: power.series.prectotcorr }) : undefined,
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