// Chash Orbit — Unified environment service
// Orchestrates NASA POWER (live), MODIS NDVI and derived water-balance estimates.
// There is no synthetic data: if NASA POWER is unreachable the request fails.

import { fetchPowerAnalysis, type PowerAnalysis } from "./power";
import { deriveSoilMoisture, type SoilMoistureAnalysis } from "./smap";
import {
  deriveRainfall,
  fetchGpmRainfallSeries,
  compareImergToPower,
  type RainfallAnalysis,
} from "./gpm";
import {
  deriveVegetation,
  getModisNdvi,
  type VegetationAnalysis,
} from "./modis";
import { getCached, setCached, CACHE_TTL, type CacheKey } from "./cache";
import { fetchPowerExtras, type PowerExtras } from "./power-extras";

export type DataSource = "live" | "cached" | "demo";

export interface Environment {
  temperature: {
    current: number;
    currentMax: number;
    heatStressDays: number;
    growingSeasonAvg: number;
    tenYearTrend: number;
    source: DataSource;
    attribution: string;
    resolution?: string;
  };
  rainfall: RainfallAnalysis;
  soilMoisture: SoilMoistureAnalysis;
  vegetation: VegetationAnalysis;
  overallSource: DataSource;
  overallAttribution: string;
  rawPower?: PowerAnalysis;
  /** root-zone soil wetness, real rainfall baseline, extreme-rain indices */
  extras?: PowerExtras | null;
}

export class NasaDataUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NasaDataUnavailableError';
  }
}

// ── Public API ──────────────────────────────────────────────────────────────
export async function fetchEnvironment(
  latitude: number,
  longitude: number,
  cropWaterMm = 500,
  currentCropIsLegume = false,
  polygon?: [number, number][] | { coordinates?: [number, number][] } | null,
): Promise<Environment> {
  const dateRange = last365Range();
  const key: CacheKey = {
    source: "power",
    latitude,
    longitude,
    dateRange,
    parameters: "T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,RH2M,WS10M+ELEV+NORM",
  };

  // MODIS NDVI runs alongside POWER; it never throws and resolves to null if
  // it can't answer within its time budget.
  const modisJob = getModisNdvi(latitude, longitude);

  let power: PowerAnalysis;
  let cacheHit = false;
  try {
    // A cache read failure (e.g. DB unavailable) should fall through to a live fetch.
    const cached = await getCached<PowerAnalysis>(key, CACHE_TTL.POWER).catch(
      () => null,
    );
    if (cached) {
      power = { ...reviveSeries(cached.data), source: "cached" as const };
      cacheHit = true;
    } else {
      power = await fetchPowerAnalysis(latitude, longitude);
      // store only the live data; mark as cached when retrieved later.
      // A failed cache write must not discard the live data we just fetched.
      await setCached(key, { ...power, source: "live" }, CACHE_TTL.POWER).catch(
        () => {},
      );
    }
  } catch (error) {
    // No synthetic fallback: report that NASA data is unavailable.
    throw new NasaDataUnavailableError(
      `NASA POWER could not be reached for this location (${error instanceof Error ? error.message : 'unknown error'}). Please try again shortly.`,
    );
  }

  // POWER extras (soil wetness, 10-year baseline, extremes). Cached like POWER
  // itself and never allowed to fail the analysis.
  let extras: PowerExtras | null = null;
  {
    const extrasKey: CacheKey = {
      source: "power-extras",
      latitude,
      longitude,
      dateRange,
      parameters: "GWETROOT,GWETTOP,PRECTOTCORR-normals",
    };
    extras = await getCached<PowerExtras>(extrasKey, CACHE_TTL.POWER)
      .then((c) => c?.data ?? null)
      .catch(() => null);
    if (!extras) {
      extras = await fetchPowerExtras(latitude, longitude, power.series).catch(
        () => null,
      );
      if (extras)
        await setCached(extrasKey, extras, CACHE_TTL.POWER).catch(() => {});
    }
  }

  const soilMoisture = deriveSoilMoisture(power, cropWaterMm, {
    measuredRootWetness: extras?.soilWetness?.rootNow ?? null,
  });
  const gpmData = await fetchGpmRainfallSeries(latitude, longitude, 30).catch(() => null);
  const rainfall = deriveRainfall(
    power,
    latitude,
    extras?.rainBaseline?.anomalyPct ?? null,
  );
  // IMERG is an independent check on POWER over the last weeks, not a replacement
  // for the full-year series the scores are built on.
  rainfall.imergCheck = gpmData ? compareImergToPower(gpmData, power) : null;
  if (rainfall.imergCheck) {
    const c = rainfall.imergCheck;
    rainfall.attribution +=
      ` Satellite check: GPM IMERG Late measured ${c.imergMm} mm over the last ${c.days} days against ${c.powerMm} mm from POWER` +
      (c.differencePct == null ? "." : ` (${c.differencePct > 0 ? "+" : ""}${c.differencePct}%).`);
  }
  const vegetation = deriveVegetation(power, latitude, await modisJob);

  // Source tagging
  const powerSrc: DataSource = cacheHit ? "cached" : power.source;
  const overallSource: DataSource =
    cacheHit ? "cached" : "live";

  return {
    temperature: {
      current: Math.round(power.currentTemp * 10) / 10,
      currentMax: Math.round(power.currentTempMax * 10) / 10,
      heatStressDays: power.heatStressDays,
      growingSeasonAvg: Math.round(power.growingSeasonAvg * 10) / 10,
      tenYearTrend: Math.round(power.tenYearTempTrend * 1000) / 1000,
      source: powerSrc,
      attribution: power.attribution,
      resolution: power.resolution ?? "0.5° × 0.5° (~50 km MERRA-2)",
    },
    rainfall,
    soilMoisture,
    vegetation,
    overallSource,
    overallAttribution:
      `${overallSource === "live" ? "Live" : "Cached"} NASA POWER${
            vegetation.source === "live" || vegetation.source === "cached"
              ? " + MODIS NDVI"
              : ""
          } (root-zone soil wetness from POWER GWETROOT)`,
    rawPower: power,
    extras,
  };
}

// JSON turns NaN (missing POWER days) into null; restore NaN so the
// derivations skip those days instead of treating them as 0 mm / 0 °C.
function reviveSeries(p: PowerAnalysis): PowerAnalysis {
  const fix = (a: (number | null)[]) => a.map((v) => (v == null ? NaN : v));
  const s = p.series;
  return {
    ...p,
    series: {
      dates: s.dates,
      t2m: fix(s.t2m),
      t2mMax: fix(s.t2mMax),
      t2mMin: fix(s.t2mMin),
      prectotcorr: fix(s.prectotcorr),
      rh2m: fix(s.rh2m),
      ws10m: fix(s.ws10m),
    },
  };
}

function last365Range(end = new Date()): string {
  const s = new Date(end);
  s.setUTCDate(s.getUTCDate() - 364);
  const ymd = (d: Date) => {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${y}${m}${dd}`;
  };
  return `${ymd(s)}-${ymd(end)}`;
}
