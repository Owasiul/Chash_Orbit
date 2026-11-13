// Chash Orbit — Dedicated background MODIS NDVI endpoint
// Enables non-blocking progressive rendering: clients poll this route
// when the initial analysis returned with `ndviLoading: true`.
// Fetches ORNL DAAC MODIS 250m subset and Sentinel-2 L2A STAC metadata.

import { NextResponse } from 'next/server';
import { getModisNdvi, deriveVegetation } from '@/lib/nasa/modis';
import { demoPower } from '@/lib/nasa/environment';
import { getCached, CACHE_TTL, type CacheKey } from '@/lib/nasa/cache';
import type { PowerAnalysis } from '@/lib/nasa/power';
import { fetchLatestSentinel2Scene } from '@/lib/nasa/sentinel';

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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const latStr = searchParams.get('lat');
  const lngStr = searchParams.get('lng');
  const polygonStr = searchParams.get('polygon');

  if (!latStr || !lngStr) {
    return NextResponse.json({ error: 'lat and lng parameters are required' }, { status: 400 });
  }

  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: 'invalid lat or lng coordinate range' }, { status: 400 });
  }

  let polygon: [number, number][] | undefined;
  if (polygonStr) {
    try {
      const parsed = JSON.parse(polygonStr);
      if (Array.isArray(parsed) && parsed.length >= 3) {
        polygon = parsed;
      }
    } catch {
      // ignore invalid polygon query and fall back to point
    }
  }

  // Calculate polygon centroid if polygon is provided
  let queryLat = lat;
  let queryLng = lng;
  let bbox: [number, number, number, number] = [lng - 0.01, lat - 0.01, lng + 0.01, lat + 0.01];

  if (polygon && polygon.length >= 3) {
    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    for (const [pLng, pLat] of polygon) {
      if (pLat < minLat) minLat = pLat;
      if (pLat > maxLat) maxLat = pLat;
      if (pLng < minLng) minLng = pLng;
      if (pLng > maxLng) maxLng = pLng;
    }
    queryLat = (minLat + maxLat) / 2;
    queryLng = (minLng + maxLng) / 2;
    bbox = [minLng, minLat, maxLng, maxLat];
  }

  // Retrieve cached POWER analysis for this location
  const powerKey: CacheKey = {
    source: 'power',
    latitude: queryLat,
    longitude: queryLng,
    dateRange: last365Range(),
    parameters: 'T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,RH2M,WS10M',
  };

  const cachedPower = await getCached<PowerAnalysis>(powerKey, CACHE_TTL.POWER).catch(() => null);
  const power = cachedPower?.data ?? demoPower(queryLat, queryLng);

  // Allow up to 25 seconds for the background MODIS fetch to complete.
  // NOTE: getModisNdvi's 3rd param is budgetMs (a polygon was wrongly passed
  // here before, corrupting the timeout so live MODIS never resolved in time).
  const [modisResult, sentinelScene] = await Promise.all([
    getModisNdvi(queryLat, queryLng, 25000),
    fetchLatestSentinel2Scene(bbox, 3000).catch(() => null),
  ]);

  const vegetation = deriveVegetation(power, queryLat, queryLng, modisResult, polygon, sentinelScene);

  return NextResponse.json({
    vegetation,
    isLiveOrCached: vegetation.source === 'live' || vegetation.source === 'cached',
  });
}
