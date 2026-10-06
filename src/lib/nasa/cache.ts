// Field Shift — NASA data cache helpers
// Stores raw NASA API responses keyed by source + rounded location + date range.
// Cache TTL is per-source (POWER: 24h, SMAP: 6h, GPM: 6h, MODIS: 24h).

import { db } from '@/lib/db';

export interface CacheKey {
  source: string;
  latitude: number;
  longitude: number;
  dateRange: string; // e.g. "20240101-20240131"
  parameters?: string;
}

// Round to 2 decimals (~1km resolution) so nearby requests share cache entries.
function roundCoord(v: number): number {
  return Math.round(v * 100) / 100;
}

export async function getCached<T>(key: CacheKey, ttlMs: number): Promise<{ data: T; hit: true } | null> {
  const lat = roundCoord(key.latitude);
  const lng = roundCoord(key.longitude);
  const row = await db.nasaCache.findUnique({
    where: {
      source_latitude_longitude_dateRange_parameters: {
        source: key.source,
        latitude: lat,
        longitude: lng,
        dateRange: key.dateRange,
        parameters: key.parameters ?? '',
      },
    },
  });
  if (!row) return null;
  if (Date.now() > row.expiresAt.getTime()) return null;
  try {
    return { data: JSON.parse(row.response) as T, hit: true };
  } catch {
    return null;
  }
}

export async function setCached<T>(key: CacheKey, data: T, ttlMs: number): Promise<void> {
  const lat = roundCoord(key.latitude);
  const lng = roundCoord(key.longitude);
  const expiresAt = new Date(Date.now() + ttlMs);
  await db.nasaCache.upsert({
    where: {
      source_latitude_longitude_dateRange_parameters: {
        source: key.source,
        latitude: lat,
        longitude: lng,
        dateRange: key.dateRange,
        parameters: key.parameters ?? '',
      },
    },
    create: {
      source: key.source,
      latitude: lat,
      longitude: lng,
      dateRange: key.dateRange,
      parameters: key.parameters ?? '',
      response: JSON.stringify(data),
      expiresAt,
    },
    update: {
      response: JSON.stringify(data),
      expiresAt,
    },
  });
}

export const CACHE_TTL = {
  POWER: 24 * 60 * 60 * 1000,   // 24h
  SMAP: 6 * 60 * 60 * 1000,     // 6h
  GPM: 6 * 60 * 60 * 1000,      // 6h
  MODIS: 24 * 60 * 60 * 1000,   // 24h
};
