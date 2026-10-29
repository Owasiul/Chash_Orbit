/**
 * Low-volume location geocoding for Chash_Orbit.
 * Uses OpenStreetMap Nominatim; no API key is required.
 * Search is performed only on form submit (not on every keystroke).
 */

export type GeoBounds = {
  south: number;
  north: number;
  west: number;
  east: number;
};

export type CountryCenter = {
  name: string;
  countryCode?: string;
  lat: number;
  lng: number;
  bounds?: GeoBounds;
};

export type ResolvedLocation = {
  query: string;
  name: string;
  displayName: string;
  lat: number;
  lng: number;
  country?: string;
  countryCode?: string;
  countryCenter?: CountryCenter;
  bounds?: GeoBounds;
  addresstype?: string;
  isCountry: boolean;
};

export type GeocodingOptions = {
  /** Defaults to the public Nominatim endpoint. A self-hosted Nominatim-compatible endpoint may be supplied. */
  baseUrl?: string;
  signal?: AbortSignal;
};

type NominatimAddress = {
  country?: string;
  country_code?: string;
};

type NominatimPlace = {
  place_id?: number;
  lat?: string;
  lon?: string;
  name?: string;
  display_name?: string;
  category?: string;
  class?: string;
  type?: string;
  addresstype?: string;
  importance?: number;
  address?: NominatimAddress;
  boundingbox?: [string, string, string, string] | string[];
};

const DEFAULT_BASE_URL = "https://nominatim.openstreetmap.org";
const CACHE_TTL_MS = 30 * 60 * 1000;
const MIN_REQUEST_GAP_MS = 1100;
const cache = new Map<string, { expiresAt: number; value: NominatimPlace[] }>();
let lastRequestStartedAt = 0;

export class LocationNotFoundError extends Error {
  constructor(query: string) {
    super(`No matching location was found for “${query}”. Try adding its district, region, or country.`);
    this.name = "LocationNotFoundError";
  }
}

export class GeocodingServiceError extends Error {
  constructor(message = "The location service is unavailable right now. Please try again shortly.") {
    super(message);
    this.name = "GeocodingServiceError";
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException("The request was cancelled.", "AbortError");
  }
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) {
    throwIfAborted(signal);
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    throwIfAborted(signal);
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(new DOMException("The request was cancelled.", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function parseBounds(raw?: NominatimPlace["boundingbox"]): GeoBounds | undefined {
  if (!raw || raw.length < 4) return undefined;
  const [south, north, west, east] = raw.map(Number);
  if (![south, north, west, east].every(Number.isFinite)) return undefined;
  return { south, north, west, east };
}

function coordinatesOf(place: NominatimPlace): { lat: number; lng: number } | undefined {
  const lat = Number(place.lat);
  const lng = Number(place.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return undefined;
  }
  return { lat, lng };
}

function isCountryPlace(place: NominatimPlace): boolean {
  return place.addresstype?.toLowerCase() === "country" || place.type?.toLowerCase() === "country";
}

function makeSearchUrl(query: string, baseUrl: string, countryCode?: string, featureType?: string): string {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const url = new URL("search", normalizedBase);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("dedupe", "1");
  url.searchParams.set("limit", "5");
  url.searchParams.set("accept-language", "en");
  if (countryCode) url.searchParams.set("countrycodes", countryCode.toLowerCase());
  if (featureType) url.searchParams.set("featuretype", featureType);
  return url.toString();
}

async function fetchPlaces(url: string, signal?: AbortSignal): Promise<NominatimPlace[]> {
  const cacheKey = url;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (cached) cache.delete(cacheKey);

  const waitMs = Math.max(0, MIN_REQUEST_GAP_MS - (Date.now() - lastRequestStartedAt));
  await wait(waitMs, signal);
  throwIfAborted(signal);
  lastRequestStartedAt = Date.now();

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      signal,
      headers: { Accept: "application/json" },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new GeocodingServiceError();
  }

  if (!response.ok) {
    throw new GeocodingServiceError(
      response.status === 429
        ? "The location service is receiving too many requests. Please wait a moment and try again."
        : `The location service returned an error (${response.status}). Please try again shortly.`,
    );
  }

  let places: NominatimPlace[];
  try {
    places = (await response.json()) as NominatimPlace[];
  } catch {
    throw new GeocodingServiceError("The location service returned an unreadable response. Please try again.");
  }

  cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value: places });
  return places;
}

function asCountryCenter(place: NominatimPlace, fallbackName: string): CountryCenter | undefined {
  const coordinates = coordinatesOf(place);
  if (!coordinates) return undefined;
  return {
    name: place.name?.trim() || fallbackName,
    countryCode: place.address?.country_code?.toLowerCase(),
    ...coordinates,
    bounds: parseBounds(place.boundingbox),
  };
}

/** Resolves a village, union, upazila, district, city, region, or country. */
export async function geocodeLocation(
  rawQuery: string,
  options: GeocodingOptions = {},
): Promise<ResolvedLocation> {
  const query = rawQuery.trim();
  if (!query) throw new LocationNotFoundError(rawQuery);

  const baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "");
  const places = await fetchPlaces(makeSearchUrl(query, baseUrl), options.signal);
  const place = places.find((candidate) => coordinatesOf(candidate) && candidate.display_name) ??
    places.find((candidate) => coordinatesOf(candidate));

  if (!place) throw new LocationNotFoundError(query);
  const coordinates = coordinatesOf(place);
  if (!coordinates) throw new LocationNotFoundError(query);

  const country = place.address?.country;
  const countryCode = place.address?.country_code?.toLowerCase();
  const isCountry = isCountryPlace(place);
  let countryCenter: CountryCenter | undefined;

  if (isCountry) {
    countryCenter = asCountryCenter(place, country || place.name || query);
  } else if (country) {
    // A country centroid is useful for the first animation stage. If lookup fails,
    // the caller simply animates straight to the result coordinates.
    try {
      const countryPlaces = await fetchPlaces(
        makeSearchUrl(country, baseUrl, countryCode, "country"),
        options.signal,
      );
      const matchingCountry = countryPlaces.find((candidate) => {
        const matchingCode = !countryCode || candidate.address?.country_code?.toLowerCase() === countryCode;
        return matchingCode && (isCountryPlace(candidate) || candidate.type === "administrative");
      }) ?? countryPlaces.find((candidate) => !countryCode || candidate.address?.country_code?.toLowerCase() === countryCode);
      if (matchingCountry) countryCenter = asCountryCenter(matchingCountry, country);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      // Deliberate graceful fallback: country lookup is optional.
    }
  }

  return {
    query,
    name: place.name?.trim() || query,
    displayName: place.display_name || place.name || query,
    ...coordinates,
    country,
    countryCode,
    countryCenter,
    bounds: parseBounds(place.boundingbox),
    addresstype: place.addresstype,
    isCountry,
  };
}
