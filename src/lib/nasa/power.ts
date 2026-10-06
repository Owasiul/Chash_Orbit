// Field Shift — NASA POWER integration (LIVE)
// Docs: https://power.larc.nasa.gov/docs/services/api/v1/
// Provides daily and monthly temperature, precipitation, and related
// meteorological parameters for any point on Earth.

const POWER_BASE = 'https://power.larc.nasa.gov/api/temporal';
const NASA_API_KEY = process.env.NASA_API_KEY || 'nABN5PLL6knLpfwithqu6yd3wezM3XggOerk5cy5';

// ── Types ───────────────────────────────────────────────────────────────────
export interface PowerDailySeries {
  dates: string[];          // 'YYYYMMDD'
  t2m: number[];            // mean 2m temperature °C
  t2mMax: number[];         // max 2m temperature °C
  t2mMin: number[];         // min 2m temperature °C
  prectotcorr: number[];    // corrected precipitation mm/day
  rh2m: number[];           // relative humidity %
  ws10m: number[];          // wind speed at 10m m/s
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
  source: 'live' | 'cached' | 'demo';
  attribution: string;
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

function last10YearRange(end = new Date()): { start: string; end: string } {
  const s = new Date(end);
  s.setUTCFullYear(s.getUTCFullYear() - 10);
  return { start: ymd(s), end: ymd(end) };
}

// ── API call ────────────────────────────────────────────────────────────────
interface PowerRawResponse {
  properties?: {
    parameter?: Record<string, Record<string, number | null>>;
  };
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

  const res = await fetch(url, {
    headers,
    // POWER can be slow on cold cache; give it generous timeouts.
    next: { revalidate: 0 },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    throw new Error(`POWER ${temporal} HTTP ${res.status}`);
  }
  return (await res.json()) as PowerRawResponse;
}

// ── Series extraction ───────────────────────────────────────────────────────
function extractSeries(raw: PowerRawResponse): PowerDailySeries {
  const p = raw.properties?.parameter;
  if (!p) throw new Error('POWER: missing parameter block');
  const t2m = p.T2M ?? {};
  const dates = Object.keys(t2m).filter(k => k !== '-999').sort();
  const toNumArr = (param: Record<string, number | null>) =>
    dates.map(d => {
      const v = param[d];
      return v == null || v === -999 ? NaN : v;
    });
  return {
    dates,
    t2m: toNumArr(p.T2M ?? {}),
    t2mMax: toNumArr(p.T2M_MAX ?? {}),
    t2mMin: toNumArr(p.T2M_MIN ?? {}),
    prectotcorr: toNumArr(p.PRECTOTCORR ?? {}),
    rh2m: toNumArr(p.RH2M ?? {}),
    ws10m: toNumArr(p.WS10M ?? {}),
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

// ── Public API ───────────────────────────────────────────────────────────────
export async function fetchPowerAnalysis(
  latitude: number,
  longitude: number,
): Promise<PowerAnalysis> {
  // Use end of "today" UTC
  const now = new Date();
  const daily = last365Range(now);
  const monthly = last10YearRange(now);

  // ── Fetch daily series ─────────────────────────────────────────────────
  const dailyRaw = await fetchPower(
    'daily',
    latitude,
    longitude,
    daily.start,
    daily.end,
    'T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,RH2M,WS10M',
  );
  const series = extractSeries(dailyRaw);

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
    const keys = Object.keys(t2mM).filter(k => k !== '-999').sort();
    const yearByKey: Record<string, number> = {};
    keys.forEach(k => {
      const yyyy = parseInt(k.slice(0, 4), 10);
      yearByKey[k] = yyyy;
    });
    // Aggregate to annual means
    const annualTemp: Record<number, number[]> = {};
    const annualRain: Record<number, number[]> = {};
    keys.forEach(k => {
      const y = yearByKey[k];
      const t = t2mM[k]; const r = preM[k];
      if (t != null && t !== -999) (annualTemp[y] ||= []).push(t);
      if (r != null && r !== -999) (annualRain[y] ||= []).push(r);
    });
    const years = Object.keys(annualTemp).map(Number).sort((a, b) => a - b);
    const tempMeans = years.map(y => mean(annualTemp[y]));
    const rainSums = years.map(y => sum(annualRain[y]));
    tenYearTempTrend = linearSlope(years, tempMeans);    // °C/year
    tenYearRainfallTrend = linearSlope(years, rainSums); // mm/year
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
    source: 'live',
    attribution: 'NASA POWER (Prediction Of Worldwide Energy Resources), NASA Langley Research Center',
  };
}
