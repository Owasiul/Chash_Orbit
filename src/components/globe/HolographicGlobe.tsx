"use client";

/**
 * HolographicGlobe
 * ----------------
 * Interactive rotating 3D Earth built with @react-three/fiber + drei.
 * Drop-in replacement for the previous react-globe.gl version — the public
 * props (and the HomeScreen `dynamic(..., { ssr: false })` wrapper) are
 * unchanged.
 *
 * Scene layout:
 *   <GlobeErrorBoundary>            ← failed texture / no WebGL → static message
 *   └─ Canvas
 *      ├─ lights + <Stars>
 *      ├─ tilt group (23.4° axial tilt)
 *      │   ├─ spin group ← rotated every frame in useFrame (Y-axis auto-rotation)
 *      │   │   ├─ <Earth/>    (day map + topology bump map, texture-Suspense)
 *      │   │   └─ <Marker/>   (amber pin: dot, halo, beam, pulsing ping)
 *      │   └─ <Atmosphere/>   (additive fresnel halo, BackSide shader)
 *      └─ <OrbitControls/>    (damping, zoom, pan disabled)
 *
 * Atmosphere, marker and auto-spin start once the Earth textures have loaded,
 * and rendering pauses while the globe is scrolled out of view.
 */

import * as React from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars, useTexture } from "@react-three/drei";

/* ---------------------------------------------------------------------- */
/* Public API (identical to the react-globe.gl version)                   */
/* ---------------------------------------------------------------------- */

export interface HolographicGlobeProps {
  /** Selected latitude in decimal degrees. Null clears the marker. */
  selectedLat?: number | null;
  /** Selected longitude in decimal degrees. Null clears the marker. */
  selectedLng?: number | null;
  /** Optional human-readable location name shown next to the coordinate readout. */
  locationName?: string | null;
  /**
   * Called once, the first time the globe finishes initializing. Also called
   * (once) if the globe falls back to its static message, so a parent that
   * waits for it to hide a loader never hangs.
   */
  onReady?: () => void;
  /** hero = full homepage centerpiece (h-full), compact = fixed h-[600px] card. */
  size?: "hero" | "compact";
  /** Whether the globe should slowly auto-rotate. Default true. */
  autoRotate?: boolean;
  /**
   * Mouse-wheel / pinch zoom. Defaults to false in hero mode so the page can
   * still scroll — same reasoning as the previous react-globe.gl version.
   */
  enableZoom?: boolean;
}

/* ---------------------------------------------------------------------- */
/* Static configuration                                                   */
/* ---------------------------------------------------------------------- */

// NOTE: third-party, un-pinned CDN URLs. For production, copy both files into
// /public/textures and point these at "/textures/earth-blue-marble.jpg" etc.
const EARTH_DAY_URL =
  "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg";
const EARTH_TOPO_URL =
  "https://unpkg.com/three-globe/example/img/earth-topology.png";

/**
 * Skip the (heavy) bump map on small screens — same trade-off as before.
 *
 * Frozen at module evaluation: we don't re-evaluate on resize. That's fine
 * because (a) the only effect is a missing bump map and (b) this module is
 * only ever loaded client-side (see the `dynamic(..., { ssr: false })`
 * wrapper) so it can't cause a hydration mismatch.
 */
const IS_MOBILE =
  typeof window !== "undefined" &&
  window.matchMedia("(max-width: 767px)").matches;

const TEXTURE_URLS: string[] = IS_MOBILE
  ? [EARTH_DAY_URL]
  : [EARTH_DAY_URL, EARTH_TOPO_URL];

// Kick off the texture downloads as soon as the chunk is evaluated.
if (typeof window !== "undefined") useTexture.preload(TEXTURE_URLS);

const ATMOSPHERE_COLOR = new THREE.Color("#22d3ee");
const MARKER_COLOR = "#fbbf24";

/** ~23.4° axial tilt, on a parent group so the spin stays on local Y. */
const TILT = THREE.MathUtils.degToRad(23.4);

/** Pleasant elevated view of the eastern Atlantic / Africa (as before). */
const INITIAL_VIEW = { lat: 18, lng: 12 } as const;

const UP = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

/** Largest per-frame time step we honour (s). A backgrounded tab can report multi-second deltas. */
const MAX_DELTA = 0.1;

/* ---------------------------------------------------------------------- */
/* Helpers                                                                */
/* ---------------------------------------------------------------------- */

interface Coords {
  lat: number;
  lng: number;
}

/**
 * Returns a clean coordinate (longitude wrapped into [-180, 180]) or null when
 * the input isn't usable. `== null` alone lets NaN / Infinity / lat = 120
 * through, and a NaN flight target would leave the camera at NaN forever.
 */
function sanitizeCoords(
  lat: number | null | undefined,
  lng: number | null | undefined,
): Coords | null {
  if (lat == null || lng == null) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90) return null;
  const wrapped =
    lng >= -180 && lng <= 180 ? lng : ((((lng + 180) % 360) + 360) % 360) - 180;
  return { lat, lng: wrapped };
}

/**
 * lat/lng (decimal degrees) → position on a sphere of `radius`.
 * Matches the default UV mapping of THREE.SphereGeometry for standard
 * equirectangular Earth textures (left edge = 180°W).
 */
function latLngToVec3(lat: number, lng: number, radius = 1): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lng + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function formatCoords(lat: number, lng: number): string {
  const latHem = lat >= 0 ? "N" : "S";
  const lngHem = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}° ${latHem} · ${Math.abs(lng).toFixed(4)}° ${lngHem}`;
}

/**
 * Y-rotation that brings INITIAL_VIEW to the front of the camera even though
 * the whole system is tilted around Z. Derived from
 *   world = Rz(TILT) · Ry(θ) · p   with the requirement world.x = 0, world.z > 0:
 *   ρ·sin(α + θ) = p.y·tan(TILT),  ρ = |p.xz|,  α = atan2(p.x, p.z)
 *   → θ = asin(p.y·tan(TILT) / ρ) − α
 */
const initialP = latLngToVec3(INITIAL_VIEW.lat, INITIAL_VIEW.lng, 1);
const INITIAL_SPIN_Y =
  Math.asin(
    THREE.MathUtils.clamp(
      (initialP.y * Math.tan(TILT)) / Math.hypot(initialP.x, initialP.z),
      -1,
      1,
    ),
  ) - Math.atan2(initialP.x, initialP.z);

/** Per-instance scratch for the camera flight (no shared module state). */
interface FlightScratch {
  dir: THREE.Vector3;
  qFull: THREE.Quaternion;
  qStep: THREE.Quaternion;
}

/**
 * One easing step of the camera flight. The camera travels along the
 * great-circle arc (constant radius, quaternion slerp) instead of the straight
 * chord between the two positions — for targets > ~120° away the chord dips
 * inside OrbitControls' minDistance (and through the globe itself past ~140°).
 * Returns true once the camera has arrived.
 */
function stepCameraToward(
  position: THREE.Vector3,
  targetDir: THREE.Vector3,
  targetDist: number,
  k: number,
  s: FlightScratch,
): boolean {
  const dist = position.length() || 1;
  s.dir.copy(position).divideScalar(dist);

  if (s.dir.angleTo(targetDir) < 0.005 && Math.abs(dist - targetDist) < 0.015) {
    position.copy(targetDir).multiplyScalar(targetDist);
    return true;
  }

  s.qFull.setFromUnitVectors(s.dir, targetDir); // full rotation to the target
  s.qStep.identity().slerp(s.qFull, k); // …of which we take a k-sized step
  s.dir.applyQuaternion(s.qStep);
  position.copy(s.dir).multiplyScalar(THREE.MathUtils.lerp(dist, targetDist, k));
  return false;
}

/* ---------------------------------------------------------------------- */
/* Atmosphere shader                                                      */
/* ---------------------------------------------------------------------- */

const ATMOSPHERE_VERT = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ATMOSPHERE_FRAG = /* glsl */ `
  varying vec3 vNormal;
  uniform vec3 uColor;
  void main() {
    // BackSide sphere: visible fragments belong to the far hemisphere, whose
    // view-space normals point away from the camera. -dot() is 0 at the outer
    // silhouette and grows toward the planet's limb -> a halo that fades out
    // softly instead of cutting off hard at the mesh edge.
    float rim = clamp(-dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0, 1.0);
    float intensity = pow(rim, 2.2) * 0.9;
    gl_FragColor = vec4(uColor * intensity, 1.0);
  }
`;

/* ---------------------------------------------------------------------- */
/* Scene pieces                                                           */
/* ---------------------------------------------------------------------- */

function Earth({ onReady }: { onReady?: () => void }) {
  const gl = useThree((s) => s.gl);
  const textures = useTexture(TEXTURE_URLS);
  const day = textures[0];
  const topo = textures[1] as THREE.Texture | undefined;

  // Deliberate render-phase mutation: colorSpace / anisotropy must be set
  // before the material's first upload, and the writes are idempotent (they
  // only fire on the very first mount that sees this cached texture), so
  // StrictMode re-renders and remounts are safe.
  if (day.colorSpace !== THREE.SRGBColorSpace) {
    day.colorSpace = THREE.SRGBColorSpace;
    day.needsUpdate = true;
  }
  const desiredAniso = Math.min(8, gl.capabilities.getMaxAnisotropy());
  if (day.anisotropy !== desiredAniso) {
    day.anisotropy = desiredAniso;
    day.needsUpdate = true;
  }

  const notifiedRef = React.useRef(false);
  React.useEffect(() => {
    if (notifiedRef.current) return;
    notifiedRef.current = true;
    onReady?.(); // fires once textures have resolved (Suspense passed)
  }, [onReady]);

  return (
    <mesh>
      <sphereGeometry args={[1, 64, 64]} />
      <meshStandardMaterial
        map={day}
        bumpMap={topo}
        bumpScale={0.1}
        roughness={0.85}
        metalness={0}
      />
    </mesh>
  );
}

function Atmosphere() {
  const uniforms = React.useMemo(
    () => ({ uColor: { value: ATMOSPHERE_COLOR.clone() } }),
    [],
  );
  return (
    <mesh scale={1.22}>
      <sphereGeometry args={[1, 64, 64]} />
      <shaderMaterial
        vertexShader={ATMOSPHERE_VERT}
        fragmentShader={ATMOSPHERE_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

/** Expanding / fading ping around the selected marker. */
function PulseRing({
  quaternion,
  offset,
  active,
}: {
  quaternion: THREE.Quaternion;
  offset: THREE.Vector3;
  active: boolean;
}) {
  const ref = React.useRef<THREE.Mesh>(null);
  const matRef = React.useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    const mesh = ref.current;
    const mat = matRef.current;
    if (!mesh || !mat) return;
    if (!active) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    const t = (clock.elapsedTime % 1.8) / 1.8;
    mesh.scale.setScalar(0.6 + t * 2.6);
    mat.opacity = 0.5 * (1 - t);
  });
  return (
    <mesh ref={ref} quaternion={quaternion} position={offset}>
      <ringGeometry args={[0.04, 0.052, 48]} />
      <meshBasicMaterial
        ref={matRef}
        color={MARKER_COLOR}
        transparent
        opacity={0.5}
        side={THREE.DoubleSide}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

/** Amber pin: dot + halo + vertical beam + reticle + pulsing ping. */
function Marker({
  lat,
  lng,
  spinPaused,
}: {
  lat: number;
  lng: number;
  spinPaused: boolean;
}) {
  const normal = React.useMemo(
    () => latLngToVec3(lat, lng, 1).normalize(),
    [lat, lng],
  );
  const surface = React.useMemo(
    () => normal.clone().multiplyScalar(1.002),
    [normal],
  );
  const ringOffset = React.useMemo(
    () => normal.clone().multiplyScalar(0.003),
    [normal],
  );
  const beamOffset = React.useMemo(
    () => normal.clone().multiplyScalar(0.15),
    [normal],
  );
  // ringGeometry lies in the XY plane (+Z normal); cylinderGeometry along +Y.
  const flatQuat = React.useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(Z_AXIS, normal),
    [normal],
  );
  const beamQuat = React.useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(UP, normal),
    [normal],
  );

  return (
    <group position={surface}>
      <mesh>
        <sphereGeometry args={[0.012, 16, 16]} />
        <meshBasicMaterial color={MARKER_COLOR} toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.024, 16, 16]} />
        <meshBasicMaterial
          color={MARKER_COLOR}
          transparent
          opacity={0.28}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh position={beamOffset} quaternion={beamQuat}>
        <cylinderGeometry args={[0.0035, 0.0035, 0.3, 8, 1, true]} />
        <meshBasicMaterial
          color={MARKER_COLOR}
          transparent
          opacity={0.5}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh position={ringOffset} quaternion={flatQuat}>
        <ringGeometry args={[0.045, 0.05, 48]} />
        <meshBasicMaterial
          color={MARKER_COLOR}
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <PulseRing
        quaternion={flatQuat}
        offset={ringOffset}
        active={!spinPaused}
      />
    </group>
  );
}

/* ---------------------------------------------------------------------- */
/* Scene contents (everything inside <Canvas>)                            */
/* ---------------------------------------------------------------------- */

interface SceneProps {
  coords: Coords | null;
  spinEnabled: boolean;
  isHero: boolean;
  enableZoom: boolean;
  onReady?: () => void;
}

interface FlightTarget {
  /** Unit vector from the globe centre toward the camera's destination. */
  dir: THREE.Vector3;
  /** Destination distance from the globe centre. */
  dist: number;
}

function SceneContents({
  coords,
  spinEnabled,
  isHero,
  enableZoom,
  onReady,
}: SceneProps) {
  const camera = useThree((s) => s.camera);
  const spinRef = React.useRef<THREE.Group>(null);

  // Atmosphere, marker and auto-spin wait for the Earth textures, so nothing
  // floats in empty space (and the starting view doesn't drift) while the
  // download is in flight.
  const [ready, setReady] = React.useState(false);
  const handleEarthReady = React.useCallback(() => {
    setReady(true);
    onReady?.();
  }, [onReady]);

  const pausedRef = React.useRef(false); // spin paused (interaction or flight)
  const draggingRef = React.useRef(false);
  const resumeTimerRef = React.useRef<number | undefined>(undefined);
  const flyRef = React.useRef<FlightTarget | null>(null);

  // Per-instance scratch for the camera flight — no module-level sharing.
  const scratchRef = React.useRef<FlightScratch>({
    dir: new THREE.Vector3(),
    qFull: new THREE.Quaternion(),
    qStep: new THREE.Quaternion(),
  });

  // Drives the marker's pulse visibility, without making useFrame depend on
  // a mutable ref.
  const [spinPaused, setSpinPaused] = React.useState(false);

  const pauseSpin = React.useCallback(() => {
    pausedRef.current = true;
    setSpinPaused(true);
    if (resumeTimerRef.current) {
      window.clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = undefined;
    }
  }, []);

  const scheduleResume = React.useCallback(() => {
    if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = window.setTimeout(() => {
      pausedRef.current = false;
      setSpinPaused(false);
    }, 2200);
  }, []);

  React.useEffect(
    () => () => {
      if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
    },
    [],
  );

  // Fly the camera above a newly selected location. The globe pauses while
  // flying so the marker's world position stays put. Waits for `ready` so we
  // don't glide the camera toward an empty scene while the Earth loads.
  React.useEffect(() => {
    if (!ready) return;
    if (!coords) {
      flyRef.current = null;
      // Selection cleared mid-flight: the pause that flight started would
      // otherwise never be lifted (no flight end → no resume timer).
      if (pausedRef.current && !draggingRef.current) scheduleResume();
      return;
    }
    const g = spinRef.current;
    if (!g) return;

    pauseSpin();
    const world = latLngToVec3(coords.lat, coords.lng, 1)
      .applyAxisAngle(UP, g.rotation.y) // current spin
      .applyAxisAngle(Z_AXIS, TILT); // parent group's axial tilt
    flyRef.current = {
      dir: world.normalize(),
      dist: THREE.MathUtils.clamp(camera.position.length(), 1.9, 3.0),
    };
  }, [coords, ready, camera, pauseSpin, scheduleResume]);

  // One frame loop drives both the camera flight and the auto-rotation.
  useFrame((state, delta) => {
    const dt = Math.min(delta, MAX_DELTA);

    const fly = flyRef.current;
    if (fly && !draggingRef.current) {
      const k = 1 - Math.exp(-3.5 * dt); // frame-rate independent easing
      const arrived = stepCameraToward(
        state.camera.position,
        fly.dir,
        fly.dist,
        k,
        scratchRef.current,
      );
      // OrbitControls (frame priority -1) already aimed the camera this frame,
      // before we moved it — re-aim so the globe stays centred during the flight.
      state.camera.lookAt(0, 0, 0);
      if (arrived) {
        flyRef.current = null;
        scheduleResume();
      }
      return;
    }

    if (spinEnabled && ready && !pausedRef.current) {
      const g = spinRef.current;
      if (g) g.rotation.y += dt * (isHero ? 0.045 : 0.02); // rad/s
    }
  });

  // Stable handlers: drei re-subscribes its controls listeners whenever
  // onStart / onEnd change identity.
  const handleControlsStart = React.useCallback(() => {
    draggingRef.current = true;
    flyRef.current = null; // grabbing the globe cancels the flight
    pauseSpin();
  }, [pauseSpin]);

  const handleControlsEnd = React.useCallback(() => {
    draggingRef.current = false;
    scheduleResume();
  }, [scheduleResume]);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.55} />
      <directionalLight position={[5, 2.5, 4]} intensity={2.4} />
      <directionalLight position={[-5, -1.5, -4]} intensity={0.3} color="#7dd3fc" />

      {/* Starfield backdrop */}
      <Stars radius={90} depth={40} count={2800} factor={3.2} saturation={0} fade speed={0.5} />

      {/* Axial tilt → spinning globe → markers */}
      <group rotation={[0, 0, TILT]}>
        <group ref={spinRef} rotation={[0, INITIAL_SPIN_Y, 0]}>
          <React.Suspense fallback={null}>
            <Earth onReady={handleEarthReady} />
          </React.Suspense>
          {ready && coords && (
            <Marker lat={coords.lat} lng={coords.lng} spinPaused={spinPaused} />
          )}
        </group>
        {ready && <Atmosphere />}
      </group>

      <OrbitControls
        makeDefault
        enablePan={false}
        enableZoom={enableZoom}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.5}
        zoomSpeed={0.6}
        minDistance={1.45}
        maxDistance={6}
        // Auto-rotation is applied to the globe itself in useFrame above, so
        // the starfield stays put. To orbit the camera instead, set
        // `autoRotate={spinEnabled}` here and remove the useFrame spin.
        autoRotate={false}
        onStart={handleControlsStart}
        onEnd={handleControlsEnd}
      />
    </>
  );
}

/* ---------------------------------------------------------------------- */
/* Failure handling                                                       */
/* ---------------------------------------------------------------------- */

function GlobeFallback({ message }: { message: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
      <p className="max-w-xs font-mono text-xs text-white/60">{message}</p>
    </div>
  );
}

/**
 * R3F re-throws anything that fails inside <Canvas> (a texture download,
 * WebGL context creation) into the surrounding React tree — without a
 * boundary here that takes the whole page down.
 */
class GlobeErrorBoundary extends React.Component<
  { fallback: React.ReactNode; onError?: () => void; children?: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("[HolographicGlobe] falling back to the static view:", error);
    // useLoader caches a rejected download; clear it so a later mount retries.
    // NOTE: this is a global cache — if another component on the page uses the
    // same URLs it will be cleared too.
    useTexture.clear(TEXTURE_URLS);
    this.props.onError?.();
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/* ---------------------------------------------------------------------- */
/* Public component                                                       */
/* ---------------------------------------------------------------------- */

export function HolographicGlobe({
  selectedLat = null,
  selectedLng = null,
  locationName = null,
  onReady,
  size = "hero",
  autoRotate = true,
  enableZoom,
}: HolographicGlobeProps) {
  const isHero = size === "hero";
  const zoom = enableZoom ?? !isHero;

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [reducedMotion, setReducedMotion] = React.useState(false);
  const [inView, setInView] = React.useState(true);

  // Probe WebGL2 *before* the first render so we never mount <Canvas> on a
  // device that can't create a context. WebGL2 only: three.js r163+ dropped
  // WebGL1, so a WebGL1-only device would pass a looser check and then crash
  // inside <Canvas>. The probe context is released immediately (browsers cap
  // live WebGL contexts, and we never render into this one).
  const [webglFailed] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      const probe = document.createElement("canvas");
      const gl = probe.getContext("webgl2");
      if (!gl) return true;
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      return false;
    } catch {
      return true;
    }
  });

  // Latest onReady, without re-running effects when the parent passes an
  // inline callback. Guarded so the boundary / probe path and the Earth
  // texture path can't double-fire it.
  const onReadyRef = React.useRef(onReady);
  React.useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);
  const notifiedRef = React.useRef(false);
  const notifyReady = React.useCallback(() => {
    if (notifiedRef.current) return;
    notifiedRef.current = true;
    onReadyRef.current?.();
  }, []);

  // WebGL probe result feeds the same single-fire notification.
  React.useEffect(() => {
    if (webglFailed) notifyReady();
  }, [webglFailed, notifyReady]);

  // Respect the user's motion preference.
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Stop rendering while the globe is scrolled out of view — otherwise a
  // full-bleed hero keeps a 60 fps MSAA @2x render loop running under the page.
  React.useEffect(() => {
    const el = containerRef.current;
    if (webglFailed || !el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const last = entries[entries.length - 1];
        if (last) setInView(last.isIntersecting);
      },
      { rootMargin: "100px" }, // wake up slightly before it scrolls into view
    );
    io.observe(el);
    return () => io.disconnect();
  }, [webglFailed]);

  const coords = React.useMemo(
    () => sanitizeCoords(selectedLat, selectedLng),
    [selectedLat, selectedLng],
  );
  const spin = autoRotate && !reducedMotion && !coords;
  const formattedCoords = coords ? formatCoords(coords.lat, coords.lng) : null;

  const containerClass = `hg-globe relative w-full overflow-hidden ${
    isHero ? "h-full" : "h-[600px]"
  }`;

  if (webglFailed) {
    return (
      <div className={containerClass}>
        <GlobeFallback message="WebGL not available — showing reduced experience" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className={containerClass}>
      {/* When wheel-zoom is off (hero background), let vertical touch
          gestures fall through to the page so mobile can still scroll. */}
      {!zoom && (
        <style>{`.hg-globe canvas, .hg-globe > div { touch-action: pan-y !important; }`}</style>
      )}

      <GlobeErrorBoundary
        fallback={
          <GlobeFallback message="Globe unavailable — showing reduced experience" />
        }
        onError={notifyReady}
      >
        <Canvas
          aria-hidden="true"
          frameloop={inView ? "always" : "never"}
          dpr={[1, 2]}
          camera={{ fov: 40, near: 0.1, far: 300, position: [0, 0.7, isHero ? 3.6 : 2.9] }}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
        >
          <SceneContents
            coords={coords}
            spinEnabled={spin}
            isHero={isHero}
            enableZoom={zoom}
            onReady={notifyReady}
          />
        </Canvas>
      </GlobeErrorBoundary>

      {/* Coordinate readout — bottom-left, mono, subtle backdrop blur */}
      {formattedCoords && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 select-none rounded-md border border-white/10 bg-black/40 px-3 py-1.5 font-mono text-[11px] text-white/75 backdrop-blur-md">
          <span>{formattedCoords}</span>
          {locationName ? (
            <span className="ml-2 text-white/40">· {locationName}</span>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default HolographicGlobe;