// Chash Orbit — Location service
// Uses the free Open-Meteo geocoding API (no auth required) for place-name
// search, plus a set of curated sample farms for the demo experience.

export interface GeoResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  countryCode: string;
  admin1?: string; // state / region
  admin2?: string; // district
  featureCode: string;
  population?: number;
  timezone?: string;
}

const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';

export async function searchLocation(query: string): Promise<GeoResult[]> {
  const q = query.trim();
  if (!q) return [];
  const url = `${GEOCODE_URL}?name=${encodeURIComponent(q)}&count=10&language=en&format=json`;
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { results?: GeoResult[] };
    return json.results ?? [];
  } catch {
    return [];
  }
}

// Curated sample farms (mentioned in the prompt).
export interface SampleFarm {
  id: string;
  name: string;
  fullName: string;
  latitude: number;
  longitude: number;
  country: string;
  note: string;
}

export const SAMPLE_FARMS: SampleFarm[] = [
  {
    id: 'rajshahi',
    name: 'Rajshahi',
    fullName: 'Rajshahi, Bangladesh',
    latitude: 24.3745,
    longitude: 88.6042,
    country: 'Bangladesh',
    note: 'Dry-season rice/wheat region with seasonal moisture stress.',
  },
  {
    id: 'punjab',
    name: 'Punjab',
    fullName: 'Punjab, India',
    // Rural Barnala district — distinct from Ludhiana city below, since farms
    // are keyed on exact coordinates.
    latitude: 30.3700,
    longitude: 75.5500,
    country: 'India',
    note: 'Intensive rice-wheat belt; groundwater depletion concern.',
  },
  {
    id: 'iowa',
    name: 'Iowa',
    fullName: 'Iowa, USA',
    latitude: 41.8780,
    longitude: -93.0977,
    country: 'United States',
    note: 'Corn-soybean rotation; temperate continental climate.',
  },
  {
    id: 'central-valley',
    name: 'California Central Valley',
    fullName: 'California Central Valley, USA',
    latitude: 37.5,
    longitude: -120.5,
    country: 'United States',
    note: 'Irrigated specialty crops; Mediterranean climate, dry summers.',
  },
  {
    id: 'ludhiana',
    name: 'Ludhiana',
    fullName: 'Ludhiana, Punjab, India',
    latitude: 30.9010,
    longitude: 75.8573,
    country: 'India',
    note: 'Punjab Agricultural University hub; rice-wheat system.',
  },
  {
    id: 'dhaka',
    name: 'Dhaka',
    fullName: 'Dhaka, Bangladesh',
    latitude: 23.8103,
    longitude: 90.4125,
    country: 'Bangladesh',
    note: 'Humid subtropical; rice-based cropping with high rainfall variability.',
  },
];

export function findSampleFarm(id: string): SampleFarm | undefined {
  return SAMPLE_FARMS.find(f => f.id === id);
}

export function formatLatLng(lat: number, lng: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}° ${latDir} · ${Math.abs(lng).toFixed(4)}° ${lngDir}`;
}

export function formatLatLngShort(lat: number, lng: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lng).toFixed(4)}° ${lngDir}`;
}
