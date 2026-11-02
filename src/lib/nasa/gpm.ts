import type { PowerAnalysis } from './power';

import {
  getCached,
  setCached,
  CACHE_TTL,
  type CacheKey,
} from './cache';

const POWER_BASE =
  'https://power.larc.nasa.gov/api/temporal';

const GPM_PARAMETER = 'IMERG_PRECTOT';

const GPM_TIMEOUT_MS = 20000;

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface GpmDailySeries {
  dates: string[];
  precipitation: number[];
  source: 'live' | 'cached';
}

export interface RainfallAnalysis {
  annualRainfall: number;
  growingSeasonRainfall: number;

  anomalyPct: number;

  anomalyBasis?:
    | 'power-10yr'
    | 'latitude-band';

  variability: number;
  drySpells: number;

  seasonalPattern: {
    month: string;
    mm: number;
  }[];

  recentTrend: number;

  // Identifies which dataset supplies the trend.
  trendSource?: string;

  source: 'live' | 'cached' | 'demo';

  attribution: string;
}

interface GpmRawResponse {
  properties?: {
    parameter?: Record<
      string,
      Record<string, number | null>
    >;
  };
}

// ─────────────────────────────────────────────
// Date helpers
// ─────────────────────────────────────────────

function formatDate(date: Date): string {
  const year = date.getUTCFullYear();

  const month = String(
    date.getUTCMonth() + 1
  ).padStart(2, '0');

  const day = String(
    date.getUTCDate()
  ).padStart(2, '0');

  return `${year}${month}${day}`;
}

function getGpmDateRange() {
  const endDate = new Date();

  // Use completed UTC days and allow time for IMERG
  // near-real-time processing.
  endDate.setUTCHours(0, 0, 0, 0);
  endDate.setUTCDate(endDate.getUTCDate() - 2);

  const startDate = new Date(endDate);

  // 365 calendar days, including both endpoints.
  startDate.setUTCDate(
    startDate.getUTCDate() - 364
  );

  return {
    start: formatDate(startDate),
    end: formatDate(endDate),
  };
}

// ─────────────────────────────────────────────
// Fetch actual NASA GPM IMERG data
// ─────────────────────────────────────────────

export async function fetchGpmRainfallSeries(
  latitude: number,
  longitude: number
): Promise<GpmDailySeries> {

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error('Invalid latitude or longitude.');
  }

  const dateRange = getGpmDateRange();

  const cacheKey: CacheKey = {
    source: 'gpm',
    latitude,
    longitude,
    dateRange:
      `${dateRange.start}-${dateRange.end}`,
    parameters: `${GPM_PARAMETER}:UTC`,
  };

  // ── Check database cache ─────────────────────

  const cached = await getCached<GpmDailySeries>(
    cacheKey,
    CACHE_TTL.GPM
  ).catch(() => null);

  if (
    cached &&
    Array.isArray(cached.data.dates) &&
    Array.isArray(cached.data.precipitation) &&
    cached.data.dates.length > 0
  ) {
    return {
      ...cached.data,
      source: 'cached',
    };
  }

  // ── Build NASA POWER request ────────────────

  const url = new URL(
    `${POWER_BASE}/daily/point`
  );

  url.search = new URLSearchParams({
    parameters: GPM_PARAMETER,
    community: 'AG',

    longitude: String(longitude),
    latitude: String(latitude),

    start: dateRange.start,
    end: dateRange.end,

    format: 'JSON',

    // NASA IMERG daily data is available in UTC.
    'time-standard': 'UTC',
  }).toString();

  // ── Request data ────────────────────────────

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(GPM_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(
      `NASA GPM API error: HTTP ${response.status}`
    );
  }

  const raw =
    (await response.json()) as GpmRawResponse;

  const rainfallData =
    raw.properties?.parameter?.[GPM_PARAMETER];

  if (!rainfallData) {
    throw new Error(
      'NASA GPM response does not contain IMERG_PRECTOT.'
    );
  }

  // ── Extract daily observations ───────────────

  const observations = Object.entries(rainfallData)
    .filter(([date]) => /^\d{8}$/.test(date))
    .filter(([, value]) =>
      typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= 0 &&
      value < 100000
    )
    .sort(([dateA], [dateB]) =>
      dateA.localeCompare(dateB)
    );

  if (!observations.length) {
    throw new Error(
      'NASA GPM returned no valid rainfall observations.'
    );
  }

  const result: GpmDailySeries = {
    dates: observations.map(([date]) => date),

    precipitation: observations.map(
      ([, value]) => value as number
    ),

    source: 'live',
  };

  // ── Save database cache ─────────────────────

  await setCached(
    cacheKey,
    result,
    CACHE_TTL.GPM
  ).catch(() => {
    // A cache failure must not discard live NASA data.
  });

  return result;
}

// ─────────────────────────────────────────────
// Statistical helpers
// ─────────────────────────────────────────────

function sum(values: number[]): number {
  return values.reduce(
    (total, value) => total + value,
    0
  );
}

function standardDeviation(
  values: number[]
): number {

  if (values.length < 2) return 0;

  const average =
    sum(values) / values.length;

  const variance =
    sum(
      values.map(value =>
        (value - average) ** 2
      )
    ) / values.length;

  return Math.sqrt(variance);
}

// ─────────────────────────────────────────────
// Monthly rainfall pattern
// ─────────────────────────────────────────────

function monthlyTotals(
  dates: string[],
  precipitation: number[]
): { month: string; mm: number }[] {

  const buckets = Array(12).fill(0);

  for (let i = 0; i < dates.length; i++) {

    const month =
      Number(dates[i].slice(4, 6)) - 1;

    const rainfall = precipitation[i];

    if (
      month >= 0 &&
      month < 12 &&
      Number.isFinite(rainfall)
    ) {
      buckets[month] += rainfall;
    }
  }

  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr',
    'May', 'Jun', 'Jul', 'Aug',
    'Sep', 'Oct', 'Nov', 'Dec',
  ];

  return monthNames.map((month, index) => ({
    month,
    mm: Math.round(buckets[index] * 10) / 10,
  }));
}

// ─────────────────────────────────────────────
// Dry spell detection
// ─────────────────────────────────────────────

function countDrySpells(
  dates: string[],
  precipitation: number[]
): number {

  let dryDays = 0;
  let drySpells = 0;
  let previousDate: number | null = null;

  const finishSpell = () => {
    if (dryDays >= 3) {
      drySpells++;
    }

    dryDays = 0;
  };

  for (let i = 0; i < dates.length; i++) {

    const currentDate = Date.parse(
      `${dates[i].slice(0, 4)}-${dates[i].slice(4, 6)}-${dates[i].slice(6, 8)}T00:00:00Z`
    );

    // Do not join dry spells across missing dates.
    if (
      previousDate !== null &&
      currentDate - previousDate > 86400000
    ) {
      finishSpell();
    }

    const rainfall = precipitation[i];

    if (rainfall < 1) {
      dryDays++;
    } else {
      finishSpell();
    }

    previousDate = currentDate;
  }

  finishSpell();

  return drySpells;
}

// ─────────────────────────────────────────────
// Latitude-based reference baseline
// ─────────────────────────────────────────────

// Approximate reference values only.
// This is NOT a GPM historical climatology.

function climatologyBaseline(lat: number): number {

  const a = Math.abs(lat);

  if (a < 10) return 1800;
  if (a < 20) return 1400;
  if (a < 30) return 1000;
  if (a < 40) return 700;
  if (a < 50) return 600;

  return 450;
}

// ─────────────────────────────────────────────
// GPM rainfall analysis
// ─────────────────────────────────────────────

function deriveGpmRainfall(
  gpm: GpmDailySeries,
  power: PowerAnalysis,
  latitude: number
): RainfallAnalysis {

  const dates = gpm.dates;
  const precipitation = gpm.precipitation;

  const annualRainfall = sum(precipitation);

  // Last 90 calendar days relative to the last
  // available GPM observation.
  const lastDate = dates[dates.length - 1];

  const endTimestamp = Date.parse(
    `${lastDate.slice(0, 4)}-${lastDate.slice(4, 6)}-${lastDate.slice(6, 8)}T00:00:00Z`
  );

  const startTimestamp =
    endTimestamp - 89 * 86400000;

  const recentRainfall = precipitation.filter(
    (_, index) => {

      const timestamp = Date.parse(
        `${dates[index].slice(0, 4)}-${dates[index].slice(4, 6)}-${dates[index].slice(6, 8)}T00:00:00Z`
      );

      return timestamp >= startTimestamp;
    }
  );

  const growingSeasonRainfall =
    sum(recentRainfall);

  const baseline =
    climatologyBaseline(latitude);

  const anomalyPct = Math.round(
    ((annualRainfall - baseline) / baseline) * 100
  );

  return {
    annualRainfall:
      Math.round(annualRainfall * 10) / 10,

    growingSeasonRainfall:
      Math.round(growingSeasonRainfall * 10) / 10,

    anomalyPct,

    // The reference is a rough latitude-based estimate,
    // not a 10-year GPM climatology.
    anomalyBasis: 'latitude-band',

    variability: Math.round(
      standardDeviation(precipitation) * 100
    ) / 100,

    drySpells: countDrySpells(
      dates,
      precipitation
    ),

    seasonalPattern: monthlyTotals(
      dates,
      precipitation
    ),

    // This trend still comes from POWER PRECTOTCORR.
    // It is deliberately not represented as a GPM trend.
    recentTrend:
      Math.round(power.tenYearRainfallTrend * 10) / 10,

    trendSource:
      'NASA POWER PRECTOTCORR 10-year trend',

    source: gpm.source,

    attribution:
      'NASA GPM IMERG (IMERG_PRECTOT), daily precipitation in UTC, approximately 0.1° (~10 km) resolution, accessed through NASA POWER. Rainfall trend uses NASA POWER PRECTOTCORR separately. Anomaly uses an approximate latitude-band reference.',
  };
}

// ─────────────────────────────────────────────
// NASA POWER fallback
// ─────────────────────────────────────────────

function derivePowerRainfall(
  power: PowerAnalysis,
  latitude: number,
  anomalyOverridePct: number | null
): RainfallAnalysis {

  if (Number.isNaN(power.annualRainfall)) {
    return {
      annualRainfall: 0,
      growingSeasonRainfall: 0,
      anomalyPct: 0,
      variability: 0,
      drySpells: 0,

      seasonalPattern: monthlyTotals(
        power.series.dates,
        power.series.prectotcorr
      ),

      recentTrend: 0,

      trendSource: 'Unavailable',

      source: 'demo',

      attribution:
        'Demo rainfall estimates. NASA GPM IMERG and NASA POWER data were unavailable.',
    };
  }

  const baseline =
    climatologyBaseline(latitude);

  const anomalyPct =
    anomalyOverridePct != null
      ? Math.round(anomalyOverridePct)
      : Math.round(
          ((power.annualRainfall - baseline) / baseline) * 100
        );

  return {
    annualRainfall:
      Math.round(power.annualRainfall * 10) / 10,

    growingSeasonRainfall:
      Math.round(power.growingSeasonRainfall * 10) / 10,

    anomalyPct,

    anomalyBasis:
      anomalyOverridePct != null
        ? 'power-10yr'
        : 'latitude-band',

    variability:
      Math.round(power.rainfallVariability * 100) / 100,

    drySpells: power.drySpells,

    seasonalPattern: monthlyTotals(
      power.series.dates,
      power.series.prectotcorr
    ),

    recentTrend:
      Math.round(power.tenYearRainfallTrend * 10) / 10,

    trendSource:
      'NASA POWER PRECTOTCORR 10-year trend',

    source: power.source,

    attribution:
      'Fallback: NASA POWER PRECTOTCORR (MERRA-2 precipitation). Direct GPM IMERG data was unavailable for this request.',
  };
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

export function deriveRainfall(
  power: PowerAnalysis,
  latitude: number,

  // Existing POWER 10-year anomaly.
  anomalyOverridePct: number | null = null,

  // New optional argument: actual GPM observations.
  // Existing callers still work without this argument.
  gpm: GpmDailySeries | null = null

): RainfallAnalysis {

  if (
    gpm &&
    gpm.dates.length > 0 &&
    gpm.precipitation.length > 0
  ) {
    return deriveGpmRainfall(
      gpm,
      power,
      latitude
    );
  }

  // Preserve your original POWER-based fallback.
  return derivePowerRainfall(
    power,
    latitude,
    anomalyOverridePct
  );
}
