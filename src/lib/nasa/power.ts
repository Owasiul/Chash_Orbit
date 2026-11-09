const POWER_BASE = 'https://power.larc.nasa.gov/api/temporal';
const NASA_API_KEY = process.env.NASA_API_KEY;

// POWER parameter groups. Kept in two separate requests so that if POWER rejects
// or lacks one of the newer agro parameters, the core analysis still works.
const CORE_PARAMS = 'T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,RH2M,WS10M';
const AGRO_PARAMS = 'ALLSKY_SFC_SW_DWN,EVPTRNS,EVLAND,TSOIL1,GWETPROF';

// ── Types ───────────────────────────────────────────────────────────────────
export interface PowerDailySeries {
  dates: string[];          // 'YYYYMMDD'
  t2m: number[];            // mean 2m temperature °C
  t2mMax: number[];         // max 2m temperature °C
  t2mMin: number[];         // min 2m temperature °C
  prectotcorr: number[];    // corrected precipitation mm/day
  rh2m: number[];           // relative humidity %
  ws10m: number[];          // wind speed at 10m m/s

  // Agro parameters (optional: absent if the extra POWER request fails).
  // Arrays are aligned 1:1 with `dates`; missing values are NaN.
  allskySfcSwDwn?: number[]; // solar radiation: crop photosynthesis & growing conditions
  evptrns?: number[];        // transpiration: plant water-use estimation
  evland?: number[];         // land evaporation: surface water loss
  tsoil1?: number[];         // soil temperature (layer 1): soil-temperature monitoring
  gwetprof?: number[];       // profile soil wetness (0-1): modelled soil-water context
}

export interface PowerAnalysis {
  series: PowerDailySeries;
  currentTemp: number;        // recent monthly mean °C
  currentTempMax: number;
  heatStressDays: number;     // days t2mMax > 35 in last 90 days
  growingSeasonAvg: number;   // °C across latest 90-day window
  annualRainfall: number;     // mm in last 365 days
  growingSeasonRainfall: number; // mm in last 90 days
  rainfallVariability: number; // std dev of daily rainfall last 365d
  drySpells: number;          // consecutive dry (>3d <1mm) spells in last 90d
  tenYearTempTrend: number;   // °C/year (slope), from monthly climatology
  tenYearRainfallTrend: number; // mm/year slope

  // Agro averages over the latest 90-day window (null if the data is unavailable).
  solarRadiationAvg?: number | null;   // ALLSKY_SFC_SW_DWN mean
  transpirationAvg?: number | null;    // EVPTRNS mean
  landEvaporationAvg?: number | null;  // EVLAND mean
  soilTempAvg?: number | null;         // TSOIL1 mean °C
  soilWetnessAvg?: number | null;      // GWETPROF mean (0-1)

  source: 'live' | 'cached' | 'demo';
  attribution: string;
  resolution?: string;
}

// ── Date helpers ────────────────────────────────────────────────────────────
function ymd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function last365Range(end = new Date()): { start: string; end: string } {
  const s = new Date(end);
  s.setUTCDate(s.getUTCDate() - 364);
  return { start: ymd(s), end: ymd(end) };
}

// The monthly endpoint takes whole years (YYYY); use the last 10 complete years.
function last10YearRange(end = new Date()): { start: string; end: string } {
  const lastFull = end.getUTCFullYear() - 1;
  return { start: String(lastFull - 9), end: String(lastFull) };
}

// ── API call with retry & exponential backoff ────────────────────────────────
interface PowerRawResponse {
  properties?: {
    parameter?: Record<string, Record<string, number | null>>;
  };
}

async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = 2,
  backoffMs = 500,
): Promise<Response> {
  let attempt = 0;
  while (true) {
    try {
      const res = await fetch(url, options);
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

async function fetchPower(
  temporal: 'daily' | 'monthly',
  latitude: number,
  longitude: number,
  start: string,
  end: string,
  parameters: string,
): Promise<PowerRawResponse> {
  const url = `${POWER_BASE}/${temporal}/point?parameters=${parameters}&community=AG&longitude=${longitude}&latitude=${latitude}&start=${start}&end=${end}&format=JSON`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (NASA_API_KEY) headers['X-Api-Key'] = NASA_API_KEY;

  const res = await fetchWithRetry(url, {
    headers,
    next: { revalidate: 0 },
    signal: AbortSignal.timeout(18000),
  }, 2, 600);
  if (!res.ok) {
    throw new Error(`POWER ${temporal} HTTP ${res.status}`);
  }
  return (await res.json()) as PowerRawResponse;
}

// ── Series extraction ───────────────────────────────────────────────────────
// Map a POWER parameter block onto a fixed list of dates (-999 / null -> NaN).
function alignToDates(
  param: Record<string, number | null> | undefined,
  dates: string[],
): number[] {
  return dates.map(d => {
    const v = param?.[d];
    return v == null || v === -999 ? NaN : v;
  });
}

function extractSeries(raw: PowerRawResponse): PowerDailySeries {
  const p = raw.properties?.parameter;
  if (!p) throw new Error('POWER: missing parameter block');
  const t2m = p.T2M ?? {};
  const dates = Object.keys(t2m).filter(k => k !== '-999').sort();
  return {
    dates,
    t2m: alignToDates(p.T2M, dates),
    t2mMax: alignToDates(p.T2M_MAX, dates),
    t2mMin: alignToDates(p.T2M_MIN, dates),
    prectotcorr: alignToDates(p.PRECTOTCORR, dates),
    rh2m: alignToDates(p.RH2M, dates),
    ws10m: alignToDates(p.WS10M, dates),
  };
}

// Agro parameters, aligned to the core series' dates. Returns {} if the request failed.
function extractAgroSeries(
  raw: PowerRawResponse | null,
  dates: string[],
): Partial<PowerDailySeries> {
  const p = raw?.properties?.parameter;
  if (!p) return {};
  return {
    allskySfcSwDwn: alignToDates(p.ALLSKY_SFC_SW_DWN, dates),
    evptrns: alignToDates(p.EVPTRNS, dates),
    evland: alignToDates(p.EVLAND, dates),
    tsoil1: alignToDates(p.TSOIL1, dates),
    gwetprof: alignToDates(p.GWETPROF, dates),
  };
}

// ── Stats helpers ───────────────────────────────────────────────────────────
function mean(a: number[]): number {
  const v = a.filter(x => !Number.isNaN(x));
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : NaN;
}
function sum(a: number[]): number {
  const v = a.filter(x => !Number.isNaN(x));
  return v.reduce((s, x) => s + x, 0);
}
function std(a: number[]): number {
  const v = a.filter(x => !Number.isNaN(x));
  if (v.length < 2) return 0;
  const m = mean(v);
  return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / v.length);
}
function linearSlope(years: number[], vals: number[]): number {
  const n = years.length;
  if (n < 2) return 0;
  const mx = mean(years);
  const my = mean(vals);
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (years[i] - mx) * (vals[i] - my);
    den += (years[i] - mx) ** 2;
  }
  return den === 0 ? 0 : num / den;
}
// Mean of the last `days` values; null when the series is missing or all-NaN.
function recentMeanOrNull(a: number[] | undefined, days = 90): number | null {
  if (!a || a.length === 0) return null;
  const m = mean(a.slice(Math.max(0, a.length - days)));
  return Number.isNaN(m) ? null : m;
}

// ── Public API ───────────────────────────────────────────────────────────────
export async function fetchPowerAnalysis(
  latitude: number,
  longitude: number,
): Promise<PowerAnalysis> {
  // Use end of "today" UTC
  const now = new Date();
  const daily = last365Range(now);
  const monthly = last10YearRange(now);

  // ── Fetch daily series (core + agro in parallel) ───────────────────────
  // Core failure throws (as before). Agro failure is non-fatal -> null.
  const [dailyRaw, agroRaw] = await Promise.all([
    fetchPower('daily', latitude, longitude, daily.start, daily.end, CORE_PARAMS),
    fetchPower('daily', latitude, longitude, daily.start, daily.end, AGRO_PARAMS)
      .catch((): PowerRawResponse | null => null),
  ]);
  const coreSeries = extractSeries(dailyRaw);
  const series: PowerDailySeries = {
    ...coreSeries,
    ...extractAgroSeries(agroRaw, coreSeries.dates),
  };

  // ── Fetch monthly series for trend (T2M + PRECTOTCORR) ─────────────────
  let tenYearTempTrend = 0;
  let tenYearRainfallTrend = 0;
  try {
    const monthlyRaw = await fetchPower(
      'monthly',
      latitude,
      longitude,
      monthly.start,
      monthly.end,
      'T2M,PRECTOTCORR',
    );
    const mp = monthlyRaw.properties?.parameter ?? {};
    const t2mM = mp.T2M ?? {};
    const preM = mp.PRECTOTCORR ?? {};
    // POWER returns 'YYYY13' as the annual value: mean °C for T2M and mean
    // mm/day for PRECTOTCORR (×365 → mm/year).
    const valid = (v: number | null | undefined): v is number => v != null && v !== -999;
    const years: number[] = [];
    const tempMeans: number[] = [];
    const rainTotals: number[] = [];
    Object.keys(t2mM).filter(k => k.endsWith('13')).sort().forEach(k => {
      const t = t2mM[k]; const r = preM[k];
      if (!valid(t) || !valid(r)) return;
      years.push(parseInt(k.slice(0, 4), 10));
      tempMeans.push(t);
      rainTotals.push(r * 365);
    });
    tenYearTempTrend = linearSlope(years, tempMeans);      // °C/year
    tenYearRainfallTrend = linearSlope(years, rainTotals); // mm/year
  } catch {
    // Trend is best-effort; ignore failures.
  }

  // ── Compute derived metrics ─────────────────────────────────────────────
  const n = series.dates.length;
  const recent90Start = Math.max(0, n - 90);
  const recent90T2mMax = series.t2mMax.slice(recent90Start);
  const recent90T2m = series.t2m.slice(recent90Start);
  const recent90Prec = series.prectotcorr.slice(recent90Start);
  const yearPrec = series.prectotcorr;

  // Heat stress days: T2M_MAX > 35 in last 90 days
  const heatStressDays = recent90T2mMax.filter(t => !Number.isNaN(t) && t > 35).length;

  // Dry spells: consecutive runs of >=3 days with <1mm rain in last 90d
  let drySpells = 0;
  let run = 0;
  for (let i = 0; i < recent90Prec.length; i++) {
    const v = recent90Prec[i];
    if (!Number.isNaN(v) && v < 1) {
      run++;
    } else {
      if (run >= 3) drySpells++;
      run = 0;
    }
  }
  if (run >= 3) drySpells++;

  return {
    series,
    currentTemp: mean(recent90T2m),
    currentTempMax: mean(recent90T2mMax),
    heatStressDays,
    growingSeasonAvg: mean(recent90T2m),
    annualRainfall: sum(yearPrec.filter(v => !Number.isNaN(v))),
    growingSeasonRainfall: sum(recent90Prec.filter(v => !Number.isNaN(v))),
    rainfallVariability: std(yearPrec),
    drySpells,
    tenYearTempTrend,
    tenYearRainfallTrend,
    solarRadiationAvg: recentMeanOrNull(series.allskySfcSwDwn),
    transpirationAvg: recentMeanOrNull(series.evptrns),
    landEvaporationAvg: recentMeanOrNull(series.evland),
    soilTempAvg: recentMeanOrNull(series.tsoil1),
    soilWetnessAvg: recentMeanOrNull(series.gwetprof),
    source: 'live',
    attribution: 'NASA POWER (Prediction Of Worldwide Energy Resources), NASA Langley Research Center',
    resolution: '0.5° × 0.5° (~50 km MERRA-2 assimilation grid, queried at field centroid)',
  };
}