// Chash Orbit — NASA Shuttle Radar Topography Mission (SRTM) Service
// Provides 30 m / 90 m global Digital Elevation Models (DEM), terrain relief,
// local slope calculation, aspect, and hydrological drainage/ponding classification.

import { getCached, setCached, CACHE_TTL, type CacheKey } from "./cache";

export type SlopeCategory = "flat" | "gentle" | "moderate" | "steep";
export type AspectCompass = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW" | "flat";
export type DrainageClass = "well-drained" | "moderate" | "poorly-drained" | "ponding-risk";
export type TerrainRoughness = "smooth" | "undulating" | "rugged";

export interface TopographyAnalysis {
  elevationM: number;                 // meters above sea level at field centroid
  minElevationM: number;
  maxElevationM: number;
  reliefM: number;                    // max - min across field
  slopePct: number;                   // slope percentage (e.g. 2.5%)
  slopeDeg: number;                   // slope degrees (e.g. 1.4°)
  slopeCategory: SlopeCategory;
  aspect: AspectCompass;
  aspectDeg: number;                  // 0 - 360°
  drainageClass: DrainageClass;
  terrainRoughness: TerrainRoughness;
  source: "SRTM_30M" | "SRTM_90M" | "DEMO";
  status: "live" | "cached" | "fallback" | "unavailable";
  attribution: string;
  resolution: string;
}

const OPEN_METEO_ELEVATION_URL = "https://api.open-meteo.com/v1/elevation";
const OPEN_ELEVATION_URL = "https://api.open-elevation.com/api/v1/lookup";
const REQUEST_TIMEOUT_MS = 6000;

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

export function classifySlope(deg: number): SlopeCategory {
  if (deg < 2) return "flat";
  if (deg < 5) return "gentle";
  if (deg < 10) return "moderate";
  return "steep";
}

export function degreesToAspect(deg: number, slopeDeg: number): AspectCompass {
  if (slopeDeg < 0.5) return "flat";
  const normalized = ((deg % 360) + 360) % 360;
  if (normalized >= 337.5 || normalized < 22.5) return "N";
  if (normalized < 67.5) return "NE";
  if (normalized < 112.5) return "E";
  if (normalized < 157.5) return "SE";
  if (normalized < 202.5) return "S";
  if (normalized < 247.5) return "SW";
  if (normalized < 292.5) return "W";
  return "NW";
}

export function classifyDrainage(elevationM: number, slopeDeg: number, reliefM: number): DrainageClass {
  // Low-lying flat terrain is prone to monsoon waterlogging / ponding
  if (slopeDeg < 1.0 && (elevationM < 25 || reliefM < 1.5)) return "ponding-risk";
  if (slopeDeg < 2.5) return "poorly-drained";
  if (slopeDeg < 8.0) return "moderate";
  return "well-drained";
}

/**
 * Calculates slope (degrees, %) and aspect from centroid and 4 cardinal offsets.
 * Points order: [Center, North, South, East, West]
 */
export function calculateSlopeAndAspect(
  elevations: number[],
  latOffsetDeg: number,
  lonOffsetDeg: number,
  latitude: number,
): { slopeDeg: number; slopePct: number; aspectDeg: number } {
  if (elevations.length < 5) return { slopeDeg: 0, slopePct: 0, aspectDeg: 0 };
  const [, zN, zS, zE, zW] = elevations;

  const latRad = (latitude * Math.PI) / 180;
  const dy = 2 * latOffsetDeg * 111320; // meters
  const dx = 2 * lonOffsetDeg * 111320 * Math.cos(latRad); // meters

  if (dx <= 0 || dy <= 0) return { slopeDeg: 0, slopePct: 0, aspectDeg: 0 };

  const dzdx = (zE - zW) / dx;
  const dzdy = (zN - zS) / dy;

  const slope = Math.sqrt(dzdx * dzdx + dzdy * dzdy);
  const slopeDeg = (Math.atan(slope) * 180) / Math.PI;
  const slopePct = slope * 100;

  // Aspect: angle of maximum descent (downhill) from north clockwise.
  // Downhill direction = negative gradient; east component = -dzdx, north = -dzdy.
  // atan2(east, north) gives the compass bearing. If north is higher (dzdy > 0),
  // water drains south (180°), not north.
  const aspectRad = Math.atan2(-dzdx, -dzdy);
  const aspectDeg = ((aspectRad * 180) / Math.PI + 360) % 360;

  return {
    slopeDeg: round1(clamp(slopeDeg, 0, 85)),
    slopePct: round1(clamp(slopePct, 0, 500)),
    aspectDeg: Math.round(aspectDeg),
  };
}

/** Deterministic synthetic topography when offline / demo */
export function demoTopography(latitude: number, longitude: number): TopographyAnalysis {
  const hash = Math.abs(Math.sin(latitude * 12.9898 + longitude * 78.233) * 43758.5453);
  const fract = hash - Math.floor(hash);
  // Coastal/delta regions (e.g. Bangladesh/South Asia plains) lower elevation, hills higher
  const baseElev = Math.abs(latitude) < 26 ? 12 + fract * 45 : 150 + fract * 300;
  const slopeDeg = round1(0.5 + fract * 4.5);
  const slopeCategory = classifySlope(slopeDeg);
  const aspectDeg = Math.round(fract * 360);
  const aspect = degreesToAspect(aspectDeg, slopeDeg);
  const reliefM = round1(1.2 + fract * 3.8);

  return {
    elevationM: round1(baseElev),
    minElevationM: round1(baseElev - reliefM / 2),
    maxElevationM: round1(baseElev + reliefM / 2),
    reliefM,
    slopePct: round1(Math.tan((slopeDeg * Math.PI) / 180) * 100),
    slopeDeg,
    slopeCategory,
    aspect,
    aspectDeg,
    drainageClass: classifyDrainage(baseElev, slopeDeg, reliefM),
    terrainRoughness: slopeDeg < 3 ? "smooth" : slopeDeg < 8 ? "undulating" : "rugged",
    source: "DEMO",
    status: "unavailable",
    attribution: "Demo topography estimates (NASA SRTM offline).",
    resolution: "30 m (~1 arc-second global DEM)",
  };
}

/**
 * Fetches Digital Elevation Model data via Open-Meteo SRTM / Copernicus endpoint.
 */
async function fetchElevations(lats: number[], lons: number[]): Promise<number[] | null> {
  const latStr = lats.map((l) => l.toFixed(5)).join(",");
  const lonStr = lons.map((l) => l.toFixed(5)).join(",");

  try {
    const url = `${OPEN_METEO_ELEVATION_URL}?latitude=${latStr}&longitude=${lonStr}`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { Accept: "application/json" },
      next: { revalidate: 86400 * 7 }, // Cache for 7 days
    } as RequestInit);

    if (res.ok) {
      const json = (await res.json()) as { elevation?: number[] };
      if (Array.isArray(json.elevation) && json.elevation.length === lats.length) {
        return json.elevation;
      }
    }
  } catch {
    // fall through to the secondary provider
  }

  // Secondary fallback: Open-Elevation API for centroid.
  // Its own controller/timeout — the primary request may have timed out, and a
  // shared AbortController would already be aborted, instantly killing this call.
  try {
    const fallbackUrl = `${OPEN_ELEVATION_URL}?locations=${lats[0].toFixed(5)},${lons[0].toFixed(5)}`;
    const fbRes = await fetch(fallbackUrl, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });
    if (fbRes.ok) {
      const fbJson = (await fbRes.json()) as { results?: Array<{ elevation?: number }> };
      const elev = fbJson.results?.[0]?.elevation;
      if (typeof elev === "number" && Number.isFinite(elev)) {
        return [elev, elev, elev, elev, elev];
      }
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Main public entry point: computes field elevation, slope, aspect, relief, and drainage.
 */
export async function fetchTopographyProfile(
  latitude: number,
  longitude: number,
  polygon?: [number, number][] | { coordinates?: [number, number][] } | null,
): Promise<TopographyAnalysis> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return demoTopography(23.8, 90.4);
  }

  const cacheKey: CacheKey = {
    source: "srtm-topography",
    latitude,
    longitude,
    dateRange: "static-dem",
    parameters: "elevation,slope,aspect",
  };

  const cached = await getCached<TopographyAnalysis>(cacheKey, 30 * 24 * 60 * 60 * 1000).catch(() => null);
  if (cached?.data) {
    return { ...cached.data, status: "cached" };
  }

  // Sample centroid + 4 cardinal directions spaced ~110m apart
  const latOffset = 0.001; // ~111m
  const cosLat = Math.cos((latitude * Math.PI) / 180);
  const lonOffset = cosLat > 0.01 ? 0.001 / cosLat : 0.001;

  const sampleLats = [latitude, latitude + latOffset, latitude - latOffset, latitude, latitude];
  const sampleLons = [longitude, longitude, longitude, longitude + lonOffset, longitude - lonOffset];

  // If a polygon boundary is provided, also sample vertices for relief
  const rawCoords: [number, number][] = Array.isArray(polygon)
    ? polygon
    : Array.isArray((polygon as { coordinates?: [number, number][] })?.coordinates)
      ? ((polygon as { coordinates?: [number, number][] }).coordinates as [number, number][])
      : [];

  const polyLats = rawCoords.map((pt) => pt[0]).filter(Number.isFinite).slice(0, 8);
  const polyLons = rawCoords.map((pt) => pt[1]).filter(Number.isFinite).slice(0, 8);

  const queryLats = [...sampleLats, ...polyLats];
  const queryLons = [...sampleLons, ...polyLons];

  const elevations = await fetchElevations(queryLats, queryLons);

  if (!elevations || elevations.length < 5 || !Number.isFinite(elevations[0])) {
    return demoTopography(latitude, longitude);
  }

  const baseElev = elevations[0];
  const cardinalElevs = elevations.slice(0, 5);
  const allElevs = elevations.filter((e) => typeof e === "number" && Number.isFinite(e));

  const minElevationM = Math.min(...allElevs);
  const maxElevationM = Math.max(...allElevs);
  const reliefM = round1(Math.max(0.5, maxElevationM - minElevationM));

  const { slopeDeg, slopePct, aspectDeg } = calculateSlopeAndAspect(
    cardinalElevs,
    latOffset,
    lonOffset,
    latitude,
  );

  const slopeCategory = classifySlope(slopeDeg);
  const aspect = degreesToAspect(aspectDeg, slopeDeg);
  const drainageClass = classifyDrainage(baseElev, slopeDeg, reliefM);
  const terrainRoughness: TerrainRoughness =
    reliefM > 15 || slopeDeg >= 10 ? "rugged" : reliefM > 5 || slopeDeg >= 4 ? "undulating" : "smooth";

  const result: TopographyAnalysis = {
    elevationM: round1(baseElev),
    minElevationM: round1(minElevationM),
    maxElevationM: round1(maxElevationM),
    reliefM,
    slopePct,
    slopeDeg,
    slopeCategory,
    aspect,
    aspectDeg,
    drainageClass,
    terrainRoughness,
    source: "SRTM_30M",
    status: "live",
    attribution: "NASA Shuttle Radar Topography Mission (SRTM 30m / 1 arc-second global DEM).",
    resolution: "30 m (~1 arc-second DEM)",
  };

  await setCached(cacheKey, result, 30 * 24 * 60 * 60 * 1000).catch(() => {});
  return result;
}
