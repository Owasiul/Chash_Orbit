import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import {
  geocodeLocation,
  GeocodingServiceError,
  LocationNotFoundError,
  type ResolvedLocation,
} from "../lib/location-geocoding";

export type GlobeNavigationStage = "idle" | "searching" | "country" | "zooming";

type GlobeView = { lat?: number; lng?: number; altitude?: number };

type GlobeMethods = {
  pointOfView(): GlobeView;
  pointOfView(view: GlobeView, transitionMs?: number): void;
};

type NavigationOptions = {
  geocoderBaseUrl?: string;
  countryFlightMs?: number;
  locationFlightMs?: number;
  countryPauseMs?: number;
};

const DEFAULT_COUNTRY_FLIGHT_MS = 1600;
const DEFAULT_LOCATION_FLIGHT_MS = 1750;
const DEFAULT_COUNTRY_PAUSE_MS = 220;

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(new DOMException("Cancelled", "AbortError"));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      reject(new DOMException("Cancelled", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function longitudeSpan(west: number, east: number): number {
  const raw = Math.abs(east - west);
  if (raw >= 359) return 360;
  return raw > 180 ? 360 - raw : raw;
}

function boundsSpan(location: ResolvedLocation): number | undefined {
  const bounds = location.bounds;
  if (!bounds) return undefined;
  return Math.max(Math.abs(bounds.north - bounds.south), longitudeSpan(bounds.west, bounds.east));
}

function countryAltitude(location: ResolvedLocation): number {
  const span = location.countryCenter?.bounds
    ? Math.max(
        Math.abs(location.countryCenter.bounds.north - location.countryCenter.bounds.south),
        longitudeSpan(location.countryCenter.bounds.west, location.countryCenter.bounds.east),
      )
    : undefined;
  // Keep the whole country-region visible, with extra breathing room for large countries.
  return span === undefined ? 1.55 : clamp(1.15 + (span / 55) * 0.9, 1.25, 2.25);
}

function targetAltitude(location: ResolvedLocation): number {
  const span = boundsSpan(location);
  if (location.isCountry) {
    return span === undefined ? 1.15 : clamp((span / 50) * 1.2, 0.12, 1.45);
  }
  // Nominatim provides bounding boxes at many administrative levels. Scale the final
  // altitude so a district isn't treated like a village, while keeping a safe minimum.
  return span === undefined ? 0.055 : clamp((span / 48) * 1.05, 0.018, 0.42);
}

function angularDistanceDegrees(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const lat1 = toRadians(aLat);
  const lat2 = toRadians(bLat);
  const deltaLat = lat2 - lat1;
  const deltaLng = toRadians(bLng - aLng);
  const haversine =
    Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return (2 * Math.asin(Math.min(1, Math.sqrt(haversine))) * 180) / Math.PI;
}

function readCurrentView(globe: GlobeMethods): GlobeView | undefined {
  try {
    const current = globe.pointOfView() as GlobeView | undefined;
    if (typeof current?.lat !== "number" || typeof current.lng !== "number") return undefined;
    return current;
  } catch {
    return undefined;
  }
}

function nearestEquivalentLongitude(targetLng: number, referenceLng?: number): number {
  if (typeof referenceLng !== "number" || !Number.isFinite(referenceLng)) return targetLng;
  // Longitudes repeat every 360°. Choosing the nearest equivalent prevents a
  // needless almost-full-world spin when moving across the antimeridian.
  return targetLng + 360 * Math.round((referenceLng - targetLng) / 360);
}

function isNearCurrentView(globe: GlobeMethods, location: ResolvedLocation): boolean {
  const current = readCurrentView(globe);
  if (!current || typeof current.lat !== "number" || typeof current.lng !== "number") return false;
  // When the destination is already visible, don't fly away to the country first;
  // zoom smoothly to the destination instead.
  const altitude = typeof current.altitude === "number" ? Math.max(0, current.altitude) : 0;
  // Approximate the visible spherical cap from camera altitude. Subtract a margin so
  // points grazing the horizon still get the clear country-to-place flight.
  const visibleCapDegrees = (Math.acos(1 / (1 + altitude)) * 180) / Math.PI;
  const alreadyVisibleThreshold = Math.max(13, visibleCapDegrees - 4);
  return angularDistanceDegrees(current.lat, current.lng, location.lat, location.lng) <= alreadyVisibleThreshold;
}

export function useGlobeLocationNavigation(
  globeRef: RefObject<GlobeMethods | null>,
  options: NavigationOptions = {},
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<GlobeNavigationStage>("idle");
  const [selectedLocation, setSelectedLocation] = useState<ResolvedLocation | null>(null);
  const operationId = useRef(0);
  const activeController = useRef<AbortController | null>(null);

  const navigateToLocation = useCallback(async (rawQuery: string) => {
    const query = rawQuery.trim();
    if (!query) {
      setError("Enter a village, union, upazila, district, city, or country to search.");
      return;
    }

    const currentOperation = ++operationId.current;
    activeController.current?.abort();
    const controller = new AbortController();
    activeController.current = controller;
    setLoading(true);
    setError(null);
    setStage("searching");

    const isCurrent = () => currentOperation === operationId.current && !controller.signal.aborted;

    try {
      const location = await geocodeLocation(query, {
        baseUrl: options.geocoderBaseUrl,
        signal: controller.signal,
      });
      if (!isCurrent()) return;
      setSelectedLocation(location);

      const globe = globeRef.current;
      if (!globe) {
        setError("The globe is still initializing. Please try the search again.");
        setStage("idle");
        return;
      }

      const initialView = readCurrentView(globe);
      const alreadyVisible = isNearCurrentView(globe, location);
      let longitudeReference = initialView?.lng;
      if (location.countryCenter && !alreadyVisible) {
        const countryLng = nearestEquivalentLongitude(location.countryCenter.lng, longitudeReference);
        longitudeReference = countryLng;
        setStage("country");
        globe.pointOfView(
          {
            lat: location.countryCenter.lat,
            lng: countryLng,
            altitude: countryAltitude(location),
          },
          options.countryFlightMs ?? DEFAULT_COUNTRY_FLIGHT_MS,
        );
        await sleep(options.countryFlightMs ?? DEFAULT_COUNTRY_FLIGHT_MS, controller.signal);
        if (!isCurrent()) return;
        // A short beat at country level makes the two separate stages legible.
        await sleep(options.countryPauseMs ?? DEFAULT_COUNTRY_PAUSE_MS, controller.signal);
        if (!isCurrent()) return;
      }

      setStage("zooming");
      globe.pointOfView(
        {
          lat: location.lat,
          lng: nearestEquivalentLongitude(location.lng, longitudeReference),
          altitude: targetAltitude(location),
        },
        options.locationFlightMs ?? DEFAULT_LOCATION_FLIGHT_MS,
      );
      await sleep(options.locationFlightMs ?? DEFAULT_LOCATION_FLIGHT_MS, controller.signal);
      if (!isCurrent()) return;
      setStage("idle");
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      if (!isCurrent()) return;
      if (caught instanceof LocationNotFoundError || caught instanceof GeocodingServiceError) {
        setError(caught.message);
      } else {
        setError("We couldn't locate that place. Check the spelling or add its district/country and try again.");
      }
      setStage("idle");
    } finally {
      if (currentOperation === operationId.current) {
        setLoading(false);
        if (activeController.current === controller) activeController.current = null;
      }
    }
  }, [globeRef, options.countryFlightMs, options.countryPauseMs, options.geocoderBaseUrl, options.locationFlightMs]);

  useEffect(() => () => {
    operationId.current += 1;
    activeController.current?.abort();
  }, []);

  return { navigateToLocation, loading, error, stage, selectedLocation } as const;
}
