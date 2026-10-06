// Field Shift — Unified environment service
// Orchestrates NASA POWER (live) and derived SMAP/GPM/MODIS estimates,
// with a stable demo fallback when NASA POWER is unreachable.

import { fetchPowerAnalysis, type PowerAnalysis } from './power';
import { deriveSoilMoisture, type SoilMoistureAnalysis } from './smap';
import { deriveRainfall, type RainfallAnalysis } from './gpm';
import { deriveVegetation, type VegetationAnalysis } from './modis';
import { getCached, setCached, CACHE_TTL, type CacheKey } from './cache';

export type DataSource = 'live' | 'cached' | 'demo';

export interface Environment {
  temperature: {
    current: number;
    currentMax: number;
    heatStressDays: number;
    growingSeasonAvg: number;
    tenYearTrend: number;
    source: DataSource;
    attribution: string;
  };
  rainfall: RainfallAnalysis;
  soilMoisture: SoilMoistureAnalysis;
  vegetation: VegetationAnalysis;
  overallSource: DataSource;
  overallAttribution: string;
  rawPower?: PowerAnalysis;
}

// ── Stable demo environment generator ──────────────────────────────────────
// Produces plausible, location-dependent demo values when NASA POWER is
// unreachable. Values are deterministic from lat/lon so demos are repeatable.
function hashLatLon(lat: number, lng: number): number {
  const x = Math.sin(lat * 12.9898 + lng * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function demoPower(lat: number, lng: number): PowerAnalysis {
  const h = hashLatLon(lat, lng);
  const a = Math.abs(lat);
  // temperature declines with latitude
  const baseT = 28 - a * 0.55 + (h - 0.5) * 4;
  const baseRain = a < 23 ? 1600 : a < 30 ? 1100 : a < 40 ? 700 : 500;
  const rain = baseRain * (0.7 + h * 0.6);
  const vari = 4 + h * 6;
  const drySpells = a > 25 ? Math.round(2 + h * 4) : Math.round(h * 2);

  // Build a synthetic 365-day series so SMAP/GPM/MODIS derivations still work.
  const dates: string[] = [];
  const t2m: number[] = [];
  const t2mMax: number[] = [];
  const t2mMin: number[] = [];
  const prectotcorr: number[] = [];
  const rh2m: number[] = [];
  const ws10m: number[] = [];
  const now = new Date();
  for (let i = 364; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    dates.push(`${d.getUTCFullYear()}${mm}${dd}`);
    // seasonal cycle (warmer mid-year in N hemisphere)
    const season = Math.cos((d.getUTCMonth() - 6 + (lat < 0 ? 6 : 0)) * Math.PI / 6);
    const t = baseT + season * 4 + (Math.sin(i * 0.7) * 1.5);
    t2m.push(t);
    t2mMax.push(t + 5);
    t2mMin.push(t - 5);
    // monsoon-ish rainfall: a wet season bump
    const wet = lat > 20 ? Math.sin((d.getUTCMonth() - 5) * Math.PI / 4) : 0.5;
    const dailyRain = Math.max(0, wet * (rain / 365) * 3 + (Math.sin(i * 1.3) + 1) * 0.5);
    prectotcorr.push(Math.round(dailyRain * 10) / 10);
    rh2m.push(60 + Math.round(season * -10 + (Math.sin(i) + 1) * 5));
    ws10m.push(2 + Math.round((Math.sin(i * 0.4) + 1) * 0.7 * 10) / 10);
  }

  const series = { dates, t2m, t2mMax, t2mMin, prectotcorr, rh2m, ws10m };
  const n = dates.length;
  const recent90 = Math.max(0, n - 90);
  const recent90T2mMax = t2mMax.slice(recent90);
  const recent90T2m = t2m.slice(recent90);
  const recent90Prec = prectotcorr.slice(recent90);
  const heatStressDays = recent90T2mMax.filter(t => t > 35).length;
  const annualRain = prectotcorr.reduce((s, v) => s + v, 0);
  const recent90Rain = recent90Prec.reduce((s, v) => s + v, 0);

  return {
    series,
    currentTemp: recent90T2m.reduce((s, v) => s + v, 0) / recent90T2m.length,
    currentTempMax: recent90T2mMax.reduce((s, v) => s + v, 0) / recent90T2mMax.length,
    heatStressDays,
    growingSeasonAvg: recent90T2m.reduce((s, v) => s + v, 0) / recent90T2m.length,
    annualRainfall: annualRain,
    growingSeasonRainfall: recent90Rain,
    rainfallVariability: vari,
    drySpells,
    tenYearTempTrend: (h - 0.5) * 0.04,
    tenYearRainfallTrend: (h - 0.5) * 8,
    source: 'demo',
    attribution: 'Demo estimate (NASA POWER unreachable). Values are illustrative.',
  };
}

// ── Public API ──────────────────────────────────────────────────────────────
export async function fetchEnvironment(
  latitude: number,
  longitude: number,
  cropWaterMm = 500,
  currentCropIsLegume = false,
): Promise<Environment> {
  const dateRange = last365Range();
  const key: CacheKey = {
    source: 'power',
    latitude,
    longitude,
    dateRange,
    parameters: 'T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,RH2M,WS10M',
  };

  let power: PowerAnalysis;
  let cacheHit = false;
  try {
    const cached = await getCached<PowerAnalysis>(key, CACHE_TTL.POWER);
    if (cached) {
      power = { ...cached.data, source: 'cached' as const };
      cacheHit = true;
    } else {
      power = await fetchPowerAnalysis(latitude, longitude);
      // store only the live data; mark as cached when retrieved later
      await setCached(key, { ...power, source: 'live' }, CACHE_TTL.POWER);
    }
  } catch {
    power = demoPower(latitude, longitude);
  }

  const soilMoisture = deriveSoilMoisture(power, cropWaterMm);
  const rainfall = deriveRainfall(power, latitude);
  const vegetation = deriveVegetation(power, latitude);

  // Source tagging
  const powerSrc: DataSource = cacheHit ? 'cached' : power.source;
  const overallSource: DataSource = power.source === 'demo' ? 'demo' : cacheHit ? 'cached' : 'live';

  return {
    temperature: {
      current: Math.round(power.currentTemp * 10) / 10,
      currentMax: Math.round(power.currentTempMax * 10) / 10,
      heatStressDays: power.heatStressDays,
      growingSeasonAvg: Math.round(power.growingSeasonAvg * 10) / 10,
      tenYearTrend: Math.round(power.tenYearTempTrend * 1000) / 1000,
      source: powerSrc,
      attribution: power.attribution,
    },
    rainfall,
    soilMoisture,
    vegetation,
    overallSource,
    overallAttribution:
      overallSource === 'live'
        ? 'Live NASA POWER (with derived SMAP/GPM/MODIS estimates)'
        : overallSource === 'cached'
          ? 'Cached NASA POWER data (with derived SMAP/GPM/MODIS estimates)'
          : 'Demo data — NASA POWER unreachable. Values are illustrative.',
    rawPower: power,
  };
}

function last365Range(end = new Date()): string {
  const s = new Date(end);
  s.setUTCDate(s.getUTCDate() - 364);
  const ymd = (d: Date) => {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${y}${m}${dd}`;
  };
  return `${ymd(s)}-${ymd(end)}`;
}
