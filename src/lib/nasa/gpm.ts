

import type { PowerAnalysis } from './power';
import {
  getCached,
  setCached,
  CACHE_TTL,
  type CacheKey,
} from './cache';


export type DataSource =
  | 'NASA_POWER'
  | 'NASA_GPM_IMERG'
  | 'NASA_SMAP'
  | 'NASA_MODIS'
  | 'DERIVED'
  | 'DEMO';

export type DataStatus =
  | 'live'
  | 'cached'
  | 'fallback'
  | 'unavailable';

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
  product: 'IMERG_LATE' | 'IMERG_FINAL' | 'POWER_PRECTOTCORR' | 'DEMO';
  spatialResolution: string;
  dataQuality: DataQuality;
}

export interface GpmMonthlySeries {
  months: string[]; // YYYYMM
  precipitation: number[];
  source: DataSource;
  status: DataStatus;
}

export interface RainfallAnalysis {
  annualRainfall: number;
  growingSeasonRainfall: number;
  growingSeasonDays: number;
  growingSeasonLabel: string;

  // Anomaly is null when no valid location-specific historical baseline exists (Update B)
  anomalyPct: number | null;
  anomalyBasis?: 'location-historical' | 'power-10yr';

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
  dataQuality: DataQuality;
}

export interface DeriveRainfallOptions {
  historicalBaselineMm?: number | null;
  cropCalendar?: {
    cropName?: string;
    plantingDate?: string; // YYYYMMDD or YYYY-MM-DD
    harvestDate?: string;  // YYYYMMDD or YYYY-MM-DD
  };
  customAnalysisDays?: number;
  minimumCoveragePct?: number; // default: 80%
}

// ─────────────────────────────────────────────
// Endpoints and Config
// ─────────────────────────────────────────────

// NASA GES DISC Daily IMERG API / OPeNDAP Endpoint (Update A)
const GES_DISC_IMERG_BASE =
  process.env.NASA_GES_DISC_GPM_URL ||
  'https://gpm1.gesdisc.eosdis.nasa.gov/opendap/GPM_L3/GPM_3IMERGDF.07';

// NASA POWER Fallback Base (Daily PRECTOTCORR & Monthly IMERG_PRECTOT)
const POWER_BASE = 'https://power.larc.nasa.gov/api/temporal';
const GPM_TIMEOUT_MS = 20000;

// ─────────────────────────────────────────────
// Date Helpers & Date Range Calculations
// ─────────────────────────────────────────────

function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function parseDateToTimestamp(dStr: string): number {
  const clean = dStr.replace(/-/g, '');
  const y = parseInt(clean.slice(0, 4), 10);
  const m = parseInt(clean.slice(4, 6), 10) - 1;
  const d = parseInt(clean.slice(6, 8), 10);
  return Date.UTC(y, m, d);
}

export function getGpmDateRange(days = 365, latencyDays = 2) {
  const endDate = new Date();
  endDate.setUTCHours(0, 0, 0, 0);
  // IMERG Late has ~14-24h latency; Final has ~3-3.5 months latency.
  endDate.setUTCDate(endDate.getUTCDate() - latencyDays);

  const startDate = new Date(endDate);
  startDate.setUTCDate(startDate.getUTCDate() - (days - 1));

  return {
    start: formatDate(startDate),
    end: formatDate(endDate),
    expectedDays: days,
  };
}

// ─────────────────────────────────────────────
// Validation & Missing Data Verification (Update D)
// ─────────────────────────────────────────────

function validateAndAssessQuality(
  dates: string[],
  precipitation: number[],
  expectedStart: string,
  expectedEnd: string
): { validDates: string[]; validPrecip: number[]; quality: DataQuality } {
  if (!Array.isArray(dates) || !Array.isArray(precipitation)) {
    throw new Error('Dates and precipitation must be valid arrays.');
  }

  if (dates.length !== precipitation.length) {
    throw new Error(
      `Array length mismatch: dates has ${dates.length} entries, precipitation has ${precipitation.length}.`
    );
  }

  const startTs = parseDateToTimestamp(expectedStart);
  const endTs = parseDateToTimestamp(expectedEnd);
  const expectedDays = Math.max(1, Math.round((endTs - startTs) / 86400000) + 1);

  let validCount = 0;
  const validDates: string[] = [];
  const validPrecip: number[] = [];

  for (let i = 0; i < dates.length; i++) {
    const d = dates[i];
    const p = precipitation[i];

    if (/^\d{8}$/.test(d.replace(/-/g, '')) && typeof p === 'number' && Number.isFinite(p) && p >= 0 && p < 1500) {
      validCount++;
      validDates.push(d.replace(/-/g, ''));
      validPrecip.push(p);
    }
  }

  const missingDays = Math.max(0, expectedDays - validCount);
  const coveragePct = Math.round((validCount / expectedDays) * 1000) / 10;
  const isReliable = coveragePct >= 80 && validCount >= 30;

  return {
    validDates,
    validPrecip,
    quality: {
      validDays: validCount,
      expectedDays,
      coveragePct,
      missingDays,
      isReliable,
    },
  };
}

// ─────────────────────────────────────────────
// GES DISC Daily GPM IMERG Fetcher
// ─────────────────────────────────────────────

async function fetchFromGesDisc(
  latitude: number,
  longitude: number,
  startDate: string,
  endDate: string
): Promise<{ dates: string[]; precipitation: number[] }> {
  // If GES DISC credentials/service is configured in the environment:
  const gesToken = process.env.EARTHDATA_TOKEN;
  if (!gesToken && !process.env.ENABLE_GES_DISC_DIRECT) {
    // Falls back gracefully to POWER PRECTOTCORR if direct GES DISC access is not setup
    throw new Error('Direct GES DISC access not enabled; utilizing fallback.');
  }

  const url = new URL(`${GES_DISC_IMERG_BASE}/point`);
  url.searchParams.set('lat', latitude.toFixed(4));
  url.searchParams.set('lon', longitude.toFixed(4));
  url.searchParams.set('start', startDate);
  url.searchParams.set('end', endDate);

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${gesToken}`,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(GPM_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`NASA GES DISC HTTP ${res.status}`);
  }

  const data = (await res.json()) as { dates: string[]; precipitation: number[] };
  return data;
}

// ─────────────────────────────────────────────
// NASA POWER Fallback Fetcher (MERRA-2 PRECTOTCORR)
// ─────────────────────────────────────────────

async function fetchPowerFallbackSeries(
  latitude: number,
  longitude: number,
  startDate: string,
  endDate: string
): Promise<{ dates: string[]; precipitation: number[] }> {
  const url = new URL(`${POWER_BASE}/daily/point`);
  url.search = new URLSearchParams({
    parameters: 'PRECTOTCORR', // Daily precipitation in POWER (MERRA-2)
    community: 'AG',
    longitude: String(longitude),
    latitude: String(latitude),
    start: startDate,
    end: endDate,
    format: 'JSON',
    'time-standard': 'UTC',
  }).toString();

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(GPM_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`NASA POWER API HTTP ${response.status}`);
  }

  const raw = (await response.json()) as {
    properties?: {
      parameter?: Record<string, Record<string, number>>;
    };
  };

  const rainfallData = raw.properties?.parameter?.['PRECTOTCORR'];
  if (!rainfallData) {
    throw new Error('NASA POWER response missing PRECTOTCORR parameter.');
  }

  const observations = Object.entries(rainfallData)
    .filter(([date]) => /^\d{8}$/.test(date))
    .sort(([a], [b]) => a.localeCompare(b));

  return {
    dates: observations.map(([d]) => d),
    precipitation: observations.map(([, v]) => (v < 0 ? 0 : v)),
  };
}

// ─────────────────────────────────────────────
// Public Daily Series Retrieval
// ─────────────────────────────────────────────

export async function fetchGpmRainfallSeries(
  latitude: number,
  longitude: number,
  customRange?: { startDate: string; endDate: string }
): Promise<GpmDailySeries> {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error('Invalid coordinates supplied.');
  }

  const range: { start: string; end: string } = customRange
    ? {
        start: customRange.startDate.replace(/-/g, ''),
        end: customRange.endDate.replace(/-/g, ''),
      }
    : getGpmDateRange(365, 2);
  const cacheKey: CacheKey = {
    source: 'gpm',
    latitude,
    longitude,
    dateRange: `${range.start}-${range.end}`,
    parameters: 'IMERG_OR_PRECTOTCORR',
  };

  // Check database cache
  const cached = await getCached<GpmDailySeries>(cacheKey, CACHE_TTL.GPM).catch(() => null);
  if (
    cached?.data?.dates?.length &&
    cached?.data?.precipitation?.length &&
    cached.data.dates.length === cached.data.precipitation.length
  ) {
    return {
      ...cached.data,
      status: 'cached',
    };
  }

  // Attempt 1: NASA GES DISC (Direct Daily GPM IMERG)
  try {
    const rawGpm = await fetchFromGesDisc(latitude, longitude, range.start, range.end);
    const { validDates, validPrecip, quality } = validateAndAssessQuality(
      rawGpm.dates,
      rawGpm.precipitation,
      range.start,
      range.end
    );

    const series: GpmDailySeries = {
      dates: validDates,
      precipitation: validPrecip,
      source: 'NASA_GPM_IMERG',
      status: 'live',
      product: 'IMERG_LATE',
      spatialResolution: '0.1° (~10 km)',
      dataQuality: quality,
    };

    await setCached(cacheKey, series, CACHE_TTL.GPM).catch(() => {});
    return series;
  } catch (gesErr) {
    // Attempt 2: NASA POWER PRECTOTCORR Fallback (Clearly labeled as POWER fallback)
    const rawPower = await fetchPowerFallbackSeries(latitude, longitude, range.start, range.end);
    const { validDates, validPrecip, quality } = validateAndAssessQuality(
      rawPower.dates,
      rawPower.precipitation,
      range.start,
      range.end
    );

    const series: GpmDailySeries = {
      dates: validDates,
      precipitation: validPrecip,
      source: 'NASA_POWER',
      status: 'fallback',
      product: 'POWER_PRECTOTCORR',
      spatialResolution: '0.5° × 0.625°',
      dataQuality: quality,
    };

    await setCached(cacheKey, series, CACHE_TTL.GPM).catch(() => {});
    return series;
  }
}

// ─────────────────────────────────────────────
// NASA POWER True Monthly IMERG Endpoint
// ─────────────────────────────────────────────

export async function fetchGpmMonthlySeries(
  latitude: number,
  longitude: number,
  startYear: number,
  endYear: number
): Promise<GpmMonthlySeries> {
  const url = new URL(`${POWER_BASE}/monthly/point`);
  url.search = new URLSearchParams({
    parameters: 'IMERG_PRECTOT', // Verified monthly parameter in NASA POWER
    community: 'AG',
    longitude: String(longitude),
    latitude: String(latitude),
    start: String(startYear),
    end: String(endYear),
    format: 'JSON',
  }).toString();

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(GPM_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`NASA POWER Monthly IMERG API error: HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    properties?: {
      parameter?: Record<string, Record<string, number>>;
    };
  };

  const rawMonthly = data.properties?.parameter?.['IMERG_PRECTOT'] || {};
  const months: string[] = [];
  const precipitation: number[] = [];

  for (const [ym, val] of Object.entries(rawMonthly)) {
    // POWER monthly keys include 13 (annual total); filter for 12 months (01..12)
    if (/^\d{4}(0[1-9]|1[0-2])$/.test(ym) && typeof val === 'number' && val >= 0) {
      months.push(ym);
      precipitation.push(val);
    }
  }

  return {
    months,
    precipitation,
    source: 'NASA_GPM_IMERG',
    status: 'live',
  };
}

// ─────────────────────────────────────────────
// Statistical Calculations
// ─────────────────────────────────────────────

function sum(values: number[]): number {
  return values.reduce((acc, v) => (Number.isFinite(v) ? acc + v : acc), 0);
}

function standardDeviation(values: number[]): number {
  const valid = values.filter((v) => Number.isFinite(v));
  if (valid.length < 2) return 0;
  const avg = sum(valid) / valid.length;
  const variance = sum(valid.map((v) => (v - avg) ** 2)) / valid.length;
  return Math.sqrt(variance);
}

function monthlyTotals(
  dates: string[],
  precipitation: number[]
): { month: string; mm: number }[] {
  const buckets = Array(12).fill(0);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (let i = 0; i < dates.length; i++) {
    const d = dates[i].replace(/-/g, '');
    const m = Number(d.slice(4, 6)) - 1;
    const p = precipitation[i];
    if (m >= 0 && m < 12 && Number.isFinite(p) && p >= 0) {
      buckets[m] += p;
    }
  }

  return monthNames.map((month, idx) => ({
    month,
    mm: Math.round(buckets[idx] * 10) / 10,
  }));
}

function analyzeDrySpells(
  dates: string[],
  precipitation: number[]
): { drySpells: number; maxConsecutiveDryDays: number } {
  let currentDryDays = 0;
  let drySpells = 0;
  let maxConsecutive = 0;
  let prevTs: number | null = null;

  const closeSpell = () => {
    if (currentDryDays >= 3) {
      drySpells++;
    }
    if (currentDryDays > maxConsecutive) {
      maxConsecutive = currentDryDays;
    }
    currentDryDays = 0;
  };

  for (let i = 0; i < dates.length; i++) {
    const curTs = parseDateToTimestamp(dates[i]);
    if (prevTs !== null && curTs - prevTs > 86400000) {
      closeSpell(); // Break consecutive count if there is a data gap
    }

    const p = precipitation[i];
    if (Number.isFinite(p) && p < 1.0) {
      currentDryDays++;
    } else {
      closeSpell();
    }
    prevTs = curTs;
  }
  closeSpell();

  return { drySpells, maxConsecutiveDryDays: maxConsecutive };
}

// ─────────────────────────────────────────────
// Rainfall Analysis Engine
// ─────────────────────────────────────────────

export function deriveRainfall(
  power: PowerAnalysis,
  latitude: number,
  anomalyOverridePct: number | null = null,
  gpm: GpmDailySeries | null = null,
  options: DeriveRainfallOptions = {}
): RainfallAnalysis {
  // Select active series
  const activeDates = gpm?.dates?.length ? gpm.dates : power.series?.dates || [];
  const activePrecip = gpm?.precipitation?.length ? gpm.precipitation : power.series?.prectotcorr || [];

  const { validDates, validPrecip, quality } = validateAndAssessQuality(
    activeDates,
    activePrecip,
    activeDates[0] || '20240101',
    activeDates[activeDates.length - 1] || '20241231'
  );

  const annualRainfall = Math.round(sum(validPrecip) * 10) / 10;
  const monthlyPattern = monthlyTotals(validDates, validPrecip);
  const monthlyValues = monthlyPattern.map((m) => m.mm);
  const monthlyStdDev = Math.round(standardDeviation(monthlyValues) * 10) / 10;
  const meanMonthly = sum(monthlyValues) / (monthlyValues.length || 1);
  const cvPct = meanMonthly > 0 ? Math.round((monthlyStdDev / meanMonthly) * 1000) / 10 : 0;

  const { drySpells, maxConsecutiveDryDays } = analyzeDrySpells(validDates, validPrecip);

  // Growing-season calculation: crop-specific calendar or analysis window (Update C)
  let growingSeasonRainfall = 0;
  let growingSeasonDays = 0;
  let growingSeasonLabel = 'Recent 90-day observation window';

  if (options.cropCalendar?.plantingDate) {
    const pTs = parseDateToTimestamp(options.cropCalendar.plantingDate);
    const hTs = options.cropCalendar.harvestDate
      ? parseDateToTimestamp(options.cropCalendar.harvestDate)
      : Date.now();

    const cropPrecip: number[] = [];
    for (let i = 0; i < validDates.length; i++) {
      const ts = parseDateToTimestamp(validDates[i]);
      if (ts >= pTs && ts <= hTs) {
        cropPrecip.push(validPrecip[i]);
      }
    }
    growingSeasonRainfall = Math.round(sum(cropPrecip) * 10) / 10;
    growingSeasonDays = cropPrecip.length;
    growingSeasonLabel = `${options.cropCalendar.cropName || 'Crop'} growing season (${options.cropCalendar.plantingDate} to ${options.cropCalendar.harvestDate || 'present'})`;
  } else {
    // Default fallback window (configurable or 90 days)
    const windowDays = options.customAnalysisDays || 90;
    const sliceCount = Math.min(windowDays, validPrecip.length);
    const recentSlice = validPrecip.slice(validPrecip.length - sliceCount);
    growingSeasonRainfall = Math.round(sum(recentSlice) * 10) / 10;
    growingSeasonDays = sliceCount;
    growingSeasonLabel = `Last ${sliceCount} days`;
  }

  // Location-Specific Baseline Anomaly (Update B)
  let anomalyPct: number | null = null;
  let anomalyBasis: RainfallAnalysis['anomalyBasis'] = undefined;

  if (options.historicalBaselineMm && options.historicalBaselineMm > 0) {
    anomalyPct = Math.round(((annualRainfall - options.historicalBaselineMm) / options.historicalBaselineMm) * 100);
    anomalyBasis = 'location-historical';
  } else if (anomalyOverridePct !== null && Number.isFinite(anomalyOverridePct)) {
    anomalyPct = Math.round(anomalyOverridePct);
    anomalyBasis = 'power-10yr';
  }

  const isGpmActive = gpm && gpm.source === 'NASA_GPM_IMERG' && gpm.status === 'live';
  const source: DataSource = isGpmActive ? 'NASA_GPM_IMERG' : 'NASA_POWER';
  const status: DataStatus = gpm?.status || (power.source === 'demo' ? 'unavailable' : 'fallback');

  const attribution = isGpmActive
    ? 'NASA GPM IMERG (GPM_3IMERGDL Late daily precipitation, ~0.1° resolution via NASA GES DISC). Rainfall trend uses NASA POWER PRECTOTCORR separately.'
    : 'NASA POWER PRECTOTCORR (MERRA-2 atmospheric reanalysis precipitation). Fallback used because direct NASA GES DISC GPM IMERG was unavailable.';

  return {
    annualRainfall,
    growingSeasonRainfall,
    growingSeasonDays,
    growingSeasonLabel,
    anomalyPct,
    anomalyBasis,
    variability: Math.round(standardDeviation(validPrecip) * 100) / 100,
    monthlyVariability: monthlyStdDev,
    coefficientOfVariationPct: cvPct,
    drySpells,
    maxConsecutiveDryDays,
    seasonalPattern: monthlyPattern,
    rainfallTrendMmPerYear: Number.isFinite(power.tenYearRainfallTrend)
      ? Math.round(power.tenYearRainfallTrend * 10) / 10
      : null,
    recentTrend: Number.isFinite(power.tenYearRainfallTrend)
      ? Math.round(power.tenYearRainfallTrend * 10) / 10
      : null,
    trendSource: 'NASA POWER PRECTOTCORR 10-year historical precipitation trend',
    source,
    status,
    attribution,
    dataQuality: quality,
  };
}