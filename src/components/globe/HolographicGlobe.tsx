"use client";

import * as React from "react";
import Globe from "react-globe.gl";
import type { GlobeMethods } from "react-globe.gl";

/**
 * HolographicGlobe
 * ----------------
 * Interactive 3D rotating Earth used as the visual centerpiece of the
 * Chash Orbit homepage (NASA Space Apps Challenge — Earth-to-farm decision
 * system). Built on `react-globe.gl` (a three.js wrapper).
 *
 * Keep all three.js / globe.gl usage inside this client component so the
 * parent can safely `dynamic(() => import('./HolographicGlobe'), { ssr:false })`.
 */

export interface HolographicGlobeProps {
  /** Selected latitude in decimal degrees. Null clears the marker. */
  selectedLat?: number | null;
  /** Selected longitude in decimal degrees. Null clears the marker. */
  selectedLng?: number | null;
  /** Optional human-readable location name shown next to the coordinate readout. */
  locationName?: string | null;
  /** Called once the globe has finished initializing. */
  onReady?: () => void;
  /** hero = full homepage centerpiece, compact = small dashboard version. */
  size?: "hero" | "compact";
  /** Whether the globe should slowly auto-rotate. Default true. */
  autoRotate?: boolean;
}

// --- Static configuration ----------------------------------------------------

const EARTH_TEXTURE_DAY = "//unpkg.com/three-globe/example/img/earth-blue-marble.jpg";
const EARTH_TEXTURE_TOPOLOGY = "//unpkg.com/three-globe/example/img/earth-topology.png";

// Cyan / teal atmosphere — harmonises with the deep-space dark page background
// and avoids the "neon blue game" look.
const ATMOSPHERE_COLOR = "#22d3ee";
const ATMOSPHERE_ALTITUDE = 0.15;

// Warm amber / gold for the selected-location marker so it pops against the
// blue Earth.
const MARKER_COLOR = "#fbbf24";

// Cyan used for orbital rings (soft, low opacity).
const RING_RGB = "34, 211, 238";

// --- Types -------------------------------------------------------------------

interface RingDatum {
  lat: number;
  lng: number;
  maxR: number;
}

interface MarkerDatum {
  lat: number;
  lng: number;
  name: string;
}

// --- Helpers -----------------------------------------------------------------

function randomRing(): RingDatum {
  return {
    lat: (Math.random() - 0.5) * 140,
    lng: (Math.random() - 0.5) * 360,
    maxR: 3 + Math.random() * 4,
  };
}

function formatCoords(lat: number, lng: number): string {
  const latHem = lat >= 0 ? "N" : "S";
  const lngHem = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}° ${latHem} · ${Math.abs(lng).toFixed(4)}° ${lngHem}`;
}

/**
 * Builds the HTML element used as the selected-location marker.
 * - A small amber dot at the surface
 * - A pulsing outer ring (`animate-ping`-style keyframe injected via <style>)
 * - A thin reticle / label ring around the dot
 * - A vertical amber beam rising from the surface so the marker is visible
 *   from any camera angle.
 */
function buildMarkerEl(): HTMLElement {
  const el = document.createElement("div");
  el.style.position = "absolute";
  el.style.pointerEvents = "none";
  el.style.transform = "translate(-50%, -50%)";
  el.style.width = "0px";
  el.style.height = "0px";
  el.style.willChange = "transform";
  el.innerHTML = `
    <div style="position:absolute; left:-1px; bottom:0; width:2px; height:64px;
                background:linear-gradient(to top, ${MARKER_COLOR}, rgba(251,191,36,0));
                box-shadow:0 0 8px 1px rgba(251,191,36,0.55);"></div>
    <div style="position:absolute; left:-6px; top:-6px; width:12px; height:12px;
                border-radius:9999px; background:${MARKER_COLOR};
                box-shadow:0 0 12px 2px rgba(251,191,36,0.85);"></div>
    <div class="hg-marker-ping" style="position:absolute; left:-14px; top:-14px;
                width:28px; height:28px; border-radius:9999px;
                background:rgba(251,191,36,0.4);
                animation:hg-marker-ping 1.8s cubic-bezier(0,0,0.2,1) infinite;"></div>
    <div style="position:absolute; left:-18px; top:-18px; width:36px; height:36px;
                border-radius:9999px; border:1px solid rgba(251,191,36,0.55);
                box-shadow:inset 0 0 6px rgba(251,191,36,0.25);"></div>
  `;
  return el;
}

// --- Component ---------------------------------------------------------------

function HolographicGlobeImpl(props: HolographicGlobeProps) {
  const {
    selectedLat = null,
    selectedLng = null,
    locationName = null,
    onReady,
    size = "hero",
    autoRotate = true,
  } = props;

  const isHero = size === "hero";

  // react-globe.gl exposes the underlying globe.gl instance through the ref.
  const globeRef = React.useRef<GlobeMethods | undefined>(undefined);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const [dims, setDims] = React.useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const [globeReady, setGlobeReady] = React.useState(false);
  const [webglFailed, setWebglFailed] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);
  const [rings, setRings] = React.useState<RingDatum[]>([]);
  const [marker, setMarker] = React.useState<MarkerDatum[]>([]);

  // --- Measure the parent container (the Globe needs explicit width/height) ----
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setDims({
        width: Math.max(0, Math.floor(rect.width)),
        height: Math.max(0, Math.floor(rect.height)),
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // --- Mobile detection — reduces quality for small screens ----------------
  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // --- Detect WebGL support so we can gracefully degrade ---------------------
  React.useEffect(() => {
    try {
      const testCanvas = document.createElement("canvas");
      const gl = testCanvas.getContext("webgl") || testCanvas.getContext("webgl2");
      if (!gl) setWebglFailed(true);
    } catch {
      setWebglFailed(true);
    }
  }, []);

  // --- Generate orbital rings (great-circle style expanding/fading pulses) ---
  React.useEffect(() => {
    if (webglFailed) return;
    const count = isMobile ? 1 : isHero ? 3 : 1;
    setRings(Array.from({ length: count }, randomRing));
  }, [isHero, isMobile, webglFailed]);

  // --- Marker data derived from selected coordinates -------------------------
  React.useEffect(() => {
    if (selectedLat != null && selectedLng != null) {
      setMarker([
        { lat: selectedLat, lng: selectedLng, name: locationName ?? "Selected" },
      ]);
    } else {
      setMarker([]);
    }
  }, [selectedLat, selectedLng, locationName]);

  // --- Reset ready flag if the container ever collapses (e.g. parent swap) ---
  React.useEffect(() => {
    if (dims.width === 0 || dims.height === 0) setGlobeReady(false);
  }, [dims]);

  // --- Configure OrbitControls + initial point-of-view once the globe is ready
  React.useEffect(() => {
    if (!globeReady) return;
    const g = globeRef.current;
    if (!g) return;

    const controls = g.controls();
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = isHero ? 0.35 : 0.15; // very slow in compact mode
    controls.enableZoom = true;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.minDistance = 180;
    controls.maxDistance = isHero ? 480 : 360;
    controls.rotateSpeed = 0.55;
    controls.zoomSpeed = 0.6;

    // Initial vantage: a pleasant elevated view of the eastern Atlantic / Africa.
    const initialAltitude = isHero ? 2.5 : 1.8;
    g.pointOfView({ lat: 18, lng: 12, altitude: initialAltitude }, 0);

    // Pause auto-rotation while the user interacts, resume after a short idle.
    // OrbitControls dispatches 'start' / 'end' events but the @types/three
    // OrbitControlsEventMap only declares 'change', so we cast to a loose
    // dispatcher here.
    const dispatcher = controls as unknown as {
      addEventListener: (type: string, listener: (e?: any) => void) => void;
      removeEventListener: (type: string, listener: (e?: any) => void) => void;
    };

    let resumeTimer: number | undefined;
    const onStart = () => {
      controls.autoRotate = false;
      if (resumeTimer) {
        window.clearTimeout(resumeTimer);
        resumeTimer = undefined;
      }
    };
    const onEnd = () => {
      if (resumeTimer) window.clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(() => {
        if (autoRotate) controls.autoRotate = true;
      }, 2000);
    };

    dispatcher.addEventListener("start", onStart);
    dispatcher.addEventListener("end", onEnd);

    return () => {
      dispatcher.removeEventListener("start", onStart);
      dispatcher.removeEventListener("end", onEnd);
      if (resumeTimer) window.clearTimeout(resumeTimer);
    };
    // We intentionally omit `onReady`/callbacks from the dependency array.
  }, [globeReady, autoRotate, isHero]);

  // --- Animate the camera to the selected location when it changes -----------
  React.useEffect(() => {
    if (!globeReady) return;
    const g = globeRef.current;
    if (!g) return;
    if (selectedLat == null || selectedLng == null) return;
    const altitude = isHero ? 2.2 : 1.4;
    g.pointOfView({ lat: selectedLat, lng: selectedLng, altitude }, 1000);
  }, [selectedLat, selectedLng, isHero, globeReady]);

  const formattedCoords =
    selectedLat != null && selectedLng != null
      ? formatCoords(selectedLat, selectedLng)
      : null;

  // --- Graceful fallback if WebGL is unavailable -----------------------------
  if (webglFailed) {
    return (
      <div className="relative flex h-full w-full items-center justify-center p-6 text-center">
        <p className="max-w-xs text-xs font-mono text-white/60">
          WebGL not available — showing reduced experience
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      <style>{`
        @keyframes hg-marker-ping {
          0% { transform: scale(0.45); opacity: 0.85; }
          80%, 100% { transform: scale(2.4); opacity: 0; }
        }
      `}</style>

      {dims.width > 0 && dims.height > 0 && (
        <Globe
          ref={globeRef as React.MutableRefObject<GlobeMethods | undefined>}
          width={dims.width}
          height={dims.height}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl={EARTH_TEXTURE_DAY}
          bumpImageUrl={isMobile ? null : EARTH_TEXTURE_TOPOLOGY}
          showAtmosphere
          atmosphereColor={ATMOSPHERE_COLOR}
          atmosphereAltitude={ATMOSPHERE_ALTITUDE}
          showGraticules={false}
          onGlobeReady={() => {
            setGlobeReady(true);
            onReady?.();
          }}
          // Orbital rings — slowly expand & fade for the satellite-mission feel.
          ringsData={rings}
          ringLat={(d: object) => (d as RingDatum).lat}
          ringLng={(d: object) => (d as RingDatum).lng}
          ringMaxRadius={(d: object) => (d as RingDatum).maxR}
          ringAltitude={0.015}
          ringPropagationSpeed={1.4}
          ringRepeatPeriod={1400}
          ringColor={() => (t: number) =>
            `rgba(${RING_RGB}, ${(0.55 * (1 - t)).toFixed(3)})`}
          // Selected-location pulsing marker with vertical beam.
          htmlElementsData={marker}
          htmlLat={(d: object) => (d as MarkerDatum).lat}
          htmlLng={(d: object) => (d as MarkerDatum).lng}
          htmlAltitude={0.012}
          htmlElement={() => buildMarkerEl()}
        />
      )}

      {/* Coordinate readout — bottom-left, mono, subtle backdrop blur */}
      {formattedCoords && (
        <div className="pointer-events-none absolute bottom-3 left-3 select-none rounded-md border border-white/10 bg-black/40 px-3 py-1.5 font-mono text-[11px] text-white/75 backdrop-blur-md">
          <span>{formattedCoords}</span>
          {locationName ? (
            <span className="ml-2 text-white/40">· {locationName}</span>
          ) : null}
        </div>
      )}
    </div>
  );
}

export const HolographicGlobe = HolographicGlobeImpl;
export default HolographicGlobeImpl;
