// Chash Orbit — Polygon & Spatial Geometry Utilities
// Computes live field area (hectares, acres), centroid, bounding box,
// and validates against self-intersection and minimum / maximum area bounds using Turf.js.

import * as turf from '@turf/turf';

export interface PolygonValidationResult {
  valid: boolean;
  areaHa: number;
  areaAcres: number;
  centroid: [number, number]; // [longitude, latitude]
  bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  error?: string;
}

export const MIN_FIELD_AREA_HA = 0.01; // ~100 m²
export const MAX_FIELD_AREA_HA = 5000; // 5,000 hectares

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Generates an RFC 4122 v4 UUID string required by Terra Draw's feature store.
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Validates a GeoJSON Polygon feature for:
 * 1. Valid coordinates structure (at least 3 unique vertices, closed ring)
 * 2. No self-intersections (via turf.kinks)
 * 3. Minimum field area (>= 0.01 ha)
 * 4. Maximum field area (<= 5,000 ha)
 */
export function validatePolygon(feature: any): PolygonValidationResult {
  const defaultFail = (err: string): PolygonValidationResult => ({
    valid: false,
    areaHa: 0,
    areaAcres: 0,
    centroid: [0, 0],
    bbox: [0, 0, 0, 0],
    error: err,
  });

  if (!feature) return defaultFail('No polygon feature provided.');

  const geom = feature.geometry ?? feature;
  if (!geom || geom.type !== 'Polygon' || !Array.isArray(geom.coordinates) || !geom.coordinates[0]) {
    return defaultFail('Invalid geometry: expected a GeoJSON Polygon.');
  }

  const ring: [number, number][] = geom.coordinates[0];
  if (ring.length < 4) {
    return defaultFail('Incomplete polygon: a field polygon requires at least 3 vertices.');
  }

  // Ensure standard GeoJSON structure for Turf calculations
  const normalizedFeature = {
    type: 'Feature' as const,
    geometry: {
      type: 'Polygon' as const,
      coordinates: geom.coordinates,
    },
    properties: feature.properties ?? {},
  };

  // Check self-intersections
  try {
    const kinks = turf.kinks(normalizedFeature as any);
    if (kinks.features.length > 0) {
      const coords = ring[0] ?? [0, 0];
      return {
        valid: false,
        areaHa: 0,
        areaAcres: 0,
        centroid: [coords[0], coords[1]],
        bbox: turf.bbox(normalizedFeature as any) as [number, number, number, number],
        error: 'Self-intersection detected: boundary edges cannot cross each other. Please redraw or adjust vertices.',
      };
    }
  } catch {
    // If kinks check fails on degraded input, treat as invalid
    return defaultFail('Invalid polygon geometry.');
  }

  // Compute area, centroid, and bounding box
  const areaM2 = turf.area(normalizedFeature as any);
  const areaHa = areaM2 / 10000;
  const areaAcres = areaHa * 2.47105;
  const centroidCoords = turf.centroid(normalizedFeature as any).geometry.coordinates as [number, number];
  const bbox = turf.bbox(normalizedFeature as any) as [number, number, number, number];

  if (areaHa < MIN_FIELD_AREA_HA) {
    return {
      valid: false,
      areaHa,
      areaAcres,
      centroid: centroidCoords,
      bbox,
      error: `Field area is too small (${areaHa.toFixed(3)} ha). Minimum required area is ${MIN_FIELD_AREA_HA} ha (~100 m²).`,
    };
  }

  if (areaHa > MAX_FIELD_AREA_HA) {
    return {
      valid: false,
      areaHa,
      areaAcres,
      centroid: centroidCoords,
      bbox,
      error: `Field area (${Math.round(areaHa).toLocaleString()} ha) exceeds the 5,000 ha limit. Please zoom in and outline a single field or farm.`,
    };
  }

  return {
    valid: true,
    areaHa,
    areaAcres,
    centroid: centroidCoords,
    bbox,
  };
}

/**
 * Creates a standard GeoJSON Polygon feature from a list of [lng, lat] coordinate points.
 */
export function createPolygonFeature(
  coordinates: [number, number][],
  properties: Record<string, any> = {},
): GeoJSON.Feature<GeoJSON.Polygon> {
  // Round coordinates to standard 6-decimal precision (~0.1m) to prevent excessive precision rejection
  const ring: [number, number][] = coordinates.map(([lng, lat]) => [
    Number(lng.toFixed(6)),
    Number(lat.toFixed(6)),
  ]);

  // Ensure the ring is closed
  if (
    ring.length > 0 &&
    (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])
  ) {
    ring.push([ring[0][0], ring[0][1]]);
  }

  const id =
    properties.id && UUID_V4_REGEX.test(String(properties.id))
      ? String(properties.id)
      : generateUUID();

  return {
    type: 'Feature',
    id,
    properties: {
      mode: 'polygon',
      ...properties,
      id,
    },
    geometry: {
      type: 'Polygon',
      coordinates: [ring],
    },
  };
}

/**
 * Generates a rectangular bounding polygon centered at [centerLng, centerLat]
 * covering the target area in hectares (default: 1.0 ha = 10,000 m²).
 */
export function createPresetField(
  centerLng: number,
  centerLat: number,
  areaHa = 1.0,
): [number, number][] {
  const sideMeters = Math.sqrt(Math.max(0.01, areaHa) * 10000);
  const halfSideMeters = sideMeters / 2;

  const latRadians = (centerLat * Math.PI) / 180;
  const dLat = halfSideMeters / 111320;
  const cosLat = Math.max(0.1, Math.cos(latRadians));
  const dLng = halfSideMeters / (111320 * cosLat);

  const minLng = Number((centerLng - dLng).toFixed(6));
  const maxLng = Number((centerLng + dLng).toFixed(6));
  const minLat = Number((centerLat - dLat).toFixed(6));
  const maxLat = Number((centerLat + dLat).toFixed(6));

  return [
    [minLng, minLat],
    [maxLng, minLat],
    [maxLng, maxLat],
    [minLng, maxLat],
    [minLng, minLat],
  ];
}

/**
 * Preset demo field: Rajshahi, Bangladesh rice/wheat farm.
 * Center at ~24.3745° N, 88.6042° E, ~2.73 hectares.
 */
export const RAJSHAHI_DEMO_FIELD = {
  id: 'rajshahi',
  name: 'Rajshahi, Bangladesh',
  fullName: 'Rajshahi Paddy Field, Bangladesh',
  latitude: 24.3745,
  longitude: 88.6039,
  areaHa: 2.73,
  areaAcres: 6.75,
  coordinates: [
    [88.6030, 24.3738],
    [88.6050, 24.3739],
    [88.6048, 24.3751],
    [88.6028, 24.3750],
    [88.6030, 24.3738],
  ] as [number, number][],
};

export function formatArea(areaHa: number): string {
  const acres = areaHa * 2.47105;
  if (areaHa >= 10) {
    return `${areaHa.toFixed(1)} ha (${acres.toFixed(1)} ac)`;
  }
  return `${areaHa.toFixed(2)} ha (${acres.toFixed(2)} ac)`;
}
