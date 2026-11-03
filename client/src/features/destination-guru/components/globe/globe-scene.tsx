import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Color, Material, Mesh, Quaternion, Texture, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import ThreeGlobe from "three-globe";
import countriesUrl from "../../data/countries-110m.geojson?url";
import { GLOBE_RADIUS, cameraPositionFor, shortestLngDelta } from "../../lib/geo";
import type { GlobeTheme } from "../../hooks/use-globe-theme";
import type { GuruDestinationItem } from "../../types";
import { DestinationPins } from "./destination-pins";

// Close enough to tell apart tightly-clustered destinations (e.g. the Greek
// islands, Balearics, Canaries) while still keeping the hex-dot land
// legible.
const MIN_DISTANCE = 150;
const MAX_DISTANCE = 420;
const MIN_POLAR_ANGLE = 0.12 * Math.PI;
const MAX_POLAR_ANGLE = 0.88 * Math.PI;
const AUTO_ROTATE_SPEED = 0.6;
const AUTO_ROTATE_RESUME_MS = 3000;
const FLIGHT_DURATION_MS = 1200;
const OCCLUDER_RADIUS = GLOBE_RADIUS * 0.998;
const HEX_POLYGON_RESOLUTION = 3;
const HEX_POLYGON_MARGIN = 0.7;
const ROTATE_SPEED_BASE = 0.7;
const ZOOM_SPEED_BASE = 1;
// Slow rotate/zoom proportionally as the camera nears MIN_DISTANCE so
// dragging over closely-packed pins stays controllable.
const MIN_SPEED_FACTOR = 0.4;

// If the fly-to target has another destination within this many degrees,
// zoom in (but never back out) to this distance so the selected pin is
// distinguishable from its neighbours.
const NEIGHBOR_THRESHOLD_DEG = 3;
const NEIGHBOR_EPSILON_DEG = 0.01;
const FLY_TO_ZOOM_DISTANCE = 200;

interface GeoJsonLike {
  features: unknown[];
}

function isGeoJsonLike(value: unknown): value is GeoJsonLike {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { features?: unknown }).features)
  );
}

let countriesPromise: Promise<unknown[]> | null = null;

async function loadCountryFeatures(): Promise<unknown[]> {
  const response = await fetch(countriesUrl);
  if (!response.ok) {
    throw new Error(`destination-globe: failed to fetch countries geojson (${response.status})`);
  }
  const data: unknown = await response.json();
  if (!isGeoJsonLike(data)) throw new Error("destination-globe: invalid countries GeoJSON shape");
  return data.features;
}

function getCountryFeatures(): Promise<unknown[]> {
  if (!countriesPromise) {
    countriesPromise = loadCountryFeatures().catch((error: unknown) => {
      // Don't cache a rejected promise forever — a transient network blip
      // would otherwise leave the globe land-less until a full page
      // reload. Reset the cache so the next mount retries the fetch.
      countriesPromise = null;
      throw error;
    });
  }
  return countriesPromise;
}

type IdleHandle = number;

// Widened locally so feature-detecting requestIdleCallback/cancelIdleCallback
// (missing in Safari) narrows normally instead of TS treating the "missing"
// branch as unreachable (lib.dom declares them as always-present on Window).
interface MaybeIdleCallbacks {
  requestIdleCallback?: (callback: () => void) => number;
  cancelIdleCallback?: (handle: number) => void;
}

type MaybeIdleWindow = Omit<Window, "requestIdleCallback" | "cancelIdleCallback"> & MaybeIdleCallbacks;

function scheduleIdle(callback: () => void): IdleHandle {
  const idleWindow = window as MaybeIdleWindow;
  if (typeof idleWindow.requestIdleCallback === "function") {
    return idleWindow.requestIdleCallback(callback);
  }
  return window.setTimeout(callback, 0);
}

function cancelIdle(handle: IdleHandle): void {
  const idleWindow = window as MaybeIdleWindow;
  if (typeof idleWindow.cancelIdleCallback === "function") {
    idleWindow.cancelIdleCallback(handle);
    return;
  }
  window.clearTimeout(handle);
}

interface ThreeGlobeMaterial {
  color: Color;
  emissive: Color;
  emissiveIntensity: number;
  shininess: number;
}

function disposeMaterial(material: Material): void {
  const maybeTextures = material as Material & Record<string, unknown>;
  for (const key of ["map", "bumpMap", "emissiveMap", "normalMap", "specularMap", "envMap"]) {
    const value = maybeTextures[key];
    if (value instanceof Texture) value.dispose();
  }
  material.dispose();
}

function disposeGlobe(instance: ThreeGlobe): void {
  if (typeof instance.pauseAnimation === "function") {
    try {
      instance.pauseAnimation();
    } catch {
      // globe may already be torn down — safe to ignore.
    }
  }

  instance.traverse((object) => {
    const mesh = object as Partial<Mesh>;
    mesh.geometry?.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) {
      material.forEach(disposeMaterial);
    } else if (material) {
      disposeMaterial(material);
    }
  });

  // Some three-globe versions expose an internal teardown hook that clears
  // its own timers / animation-frame loop; call it if present, best-effort.
  if (typeof instance._destructor === "function") {
    try {
      instance._destructor();
    } catch {
      // best-effort — safe to ignore.
    }
  }
}

function clampLatToPolarLimits(lat: number): number {
  const maxLat = 90 - (MIN_POLAR_ANGLE * 180) / Math.PI;
  const minLat = 90 - (MAX_POLAR_ANGLE * 180) / Math.PI;
  return Math.min(maxLat, Math.max(minLat, lat));
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Cheap approximate angular distance in degrees between two lat/lng points,
// correcting longitude delta for latitude compression so nearby-in-reality
// destinations at higher latitudes (e.g. the Greek islands) aren't
// under-counted as "far apart".
function angularDistanceDeg(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = aLat - bLat;
  const dLng = shortestLngDelta(aLng, bLng) * Math.cos((((aLat + bLat) / 2) * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

function hasNearbyNeighbor(items: GuruDestinationItem[], lat: number, lng: number): boolean {
  return items.some((item) => {
    if (item.lat === null || item.lng === null) return false;
    const dist = angularDistanceDeg(lat, lng, item.lat, item.lng);
    return dist > NEIGHBOR_EPSILON_DEG && dist <= NEIGHBOR_THRESHOLD_DEG;
  });
}

interface Flight {
  fromDir: Vector3;
  toDir: Vector3;
  fromDistance: number;
  toDistance: number;
  start: number;
  duration: number;
}

export interface GlobeSceneProps {
  items: GuruDestinationItem[];
  selectedKey: string | null;
  flyTo: { lat: number; lng: number; nonce: number } | null;
  paused: boolean;
  onPinClick: (key: string) => void;
  onBackgroundClick?: () => void;
  hoveredKey: string | null;
  onHoverChange: (key: string | null) => void;
  hoverCardRef: RefObject<HTMLDivElement | null>;
  theme: GlobeTheme;
  reducedMotion: boolean;
  onReady?: () => void;
}

export function GlobeScene({
  items,
  selectedKey,
  flyTo,
  paused,
  onPinClick,
  onBackgroundClick,
  hoveredKey,
  onHoverChange,
  hoverCardRef,
  theme,
  reducedMotion,
  onReady,
}: GlobeSceneProps) {
  const { camera, size, invalidate } = useThree();
  const [globe, setGlobe] = useState<ThreeGlobe | null>(null);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const flightRef = useRef<Flight | null>(null);
  const lastFlyToNonceRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const lastInteractionRef = useRef(0);
  // Scratch objects reused every frame during a fly-to so the animation
  // doesn't allocate a fresh Quaternion/Vector3 per frame.
  const scratchRotationQuat = useRef(new Quaternion());
  const scratchStepQuat = useRef(new Quaternion());
  const scratchDir = useRef(new Vector3());

  // Build the ThreeGlobe instance once, after first paint — hex-polygon init
  // blocks the main thread for ~0.5-1.5s, so we defer it via
  // requestIdleCallback (falling back to a macrotask). useState (not
  // useMemo) + effect cleanup below so this survives StrictMode's
  // mount/unmount/remount without leaking an orphaned instance.
  useEffect(() => {
    let cancelled = false;
    let instance: ThreeGlobe | null = null;

    const idleHandle = scheduleIdle(() => {
      void (async () => {
        let features: unknown[] = [];
        try {
          features = await getCountryFeatures();
        } catch (error) {
          console.error("[destination-globe] failed to load countries geojson", error);
        }
        if (cancelled) return;

        instance = new ThreeGlobe();
        instance
          .hexPolygonsData(features as object[])
          .hexPolygonResolution(HEX_POLYGON_RESOLUTION)
          .hexPolygonMargin(HEX_POLYGON_MARGIN)
          .hexPolygonColor(() => theme.polygonColor)
          .showAtmosphere(true)
          .atmosphereColor(theme.atmosphereColor)
          .atmosphereAltitude(0.18);

        const material = instance.globeMaterial() as unknown as ThreeGlobeMaterial;
        material.color = new Color(theme.globeColor);
        material.emissive = new Color(theme.globeColor);
        material.emissiveIntensity = 0.15;
        material.shininess = 0.7;

        if (cancelled) {
          disposeGlobe(instance);
          return;
        }
        setGlobe(instance);
        onReady?.();
      })();
    });

    return () => {
      cancelled = true;
      cancelIdle(idleHandle);
      if (instance) disposeGlobe(instance);
    };
    // Built once per mount — theme changes are applied in the effect below
    // without rebuilding.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply theme changes to the existing globe instance without rebuilding it.
  useEffect(() => {
    if (!globe) return;
    const material = globe.globeMaterial() as unknown as ThreeGlobeMaterial;
    material.color.set(theme.globeColor);
    material.emissive.set(theme.globeColor);
    globe.atmosphereColor(theme.atmosphereColor);
    globe.hexPolygonColor(() => theme.polygonColor);
  }, [globe, theme.globeColor, theme.atmosphereColor, theme.polygonColor]);

  const handleControlsStart = () => {
    isDraggingRef.current = true;
    lastInteractionRef.current = performance.now();
    flightRef.current = null;
  };

  const handleControlsEnd = () => {
    isDraggingRef.current = false;
    lastInteractionRef.current = performance.now();
  };

  // Fly-to: start a new flight whenever the nonce changes.
  useEffect(() => {
    if (!flyTo || lastFlyToNonceRef.current === flyTo.nonce) return;
    lastFlyToNonceRef.current = flyTo.nonce;

    const clampedLat = clampLatToPolarLimits(flyTo.lat);
    const currentDistance = camera.position.length() || MIN_DISTANCE;
    // Zoom in (never back out) when the target sits near other pins, so the
    // selected destination is distinguishable from its neighbours.
    const targetDistance = hasNearbyNeighbor(items, flyTo.lat, flyTo.lng)
      ? Math.min(currentDistance, FLY_TO_ZOOM_DISTANCE)
      : currentDistance;
    const toPos = cameraPositionFor(clampedLat, flyTo.lng, targetDistance);
    const toDir = new Vector3(toPos.x, toPos.y, toPos.z).normalize();

    if (reducedMotion) {
      camera.position.copy(toDir).multiplyScalar(targetDistance);
      camera.lookAt(0, 0, 0);
      controlsRef.current?.update();
      flightRef.current = null;
      // Render the snapped position even if frameloop is currently
      // "demand" (e.g. the drawer is open) — see the frameloop note below.
      invalidate();
      return;
    }

    flightRef.current = {
      fromDir: camera.position.clone().normalize(),
      toDir,
      fromDistance: currentDistance,
      toDistance: targetDistance,
      start: performance.now(),
      duration: FLIGHT_DURATION_MS,
    };
    // Kick off the first frame of the flight even if frameloop is
    // currently "demand" — the page can open the drawer (which flips
    // `paused`/frameloop to "demand") in the same tick as setting flyTo,
    // so nothing else would otherwise trigger a render.
    invalidate();
  }, [flyTo, camera, reducedMotion, items, invalidate]);

  useFrame(() => {
    // Progress an in-flight fly-to animation.
    const flight = flightRef.current;
    if (flight) {
      const now = performance.now();
      const t = Math.min(1, (now - flight.start) / flight.duration);
      const eased = easeInOutCubic(t);
      scratchRotationQuat.current.setFromUnitVectors(flight.fromDir, flight.toDir);
      scratchStepQuat.current.identity().slerp(scratchRotationQuat.current, eased);
      scratchDir.current.copy(flight.fromDir).applyQuaternion(scratchStepQuat.current);
      const distance = flight.fromDistance + (flight.toDistance - flight.fromDistance) * eased;
      camera.position.copy(scratchDir.current).multiplyScalar(distance);
      camera.lookAt(0, 0, 0);
      controlsRef.current?.update();
      if (t >= 1) {
        flightRef.current = null;
      } else {
        // Keep pumping frames while flying, even in "demand" frameloop
        // mode (the sheet can be open mid-flight) — only stop once the
        // flight actually completes.
        invalidate();
      }
    }

    const controls = controlsRef.current;
    if (!controls) return;

    // Slow rotate/zoom proportionally as the camera nears MIN_DISTANCE so
    // dragging over dense pin clusters stays controllable.
    const distance = camera.position.length();
    const proximity = Math.min(
      1,
      Math.max(0, (distance - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE)),
    );
    const speedFactor = MIN_SPEED_FACTOR + (1 - MIN_SPEED_FACTOR) * proximity;
    controls.rotateSpeed = ROTATE_SPEED_BASE * speedFactor;
    controls.zoomSpeed = ZOOM_SPEED_BASE * speedFactor;

    // Auto-rotate only when nothing is competing for the camera.
    const sinceInteraction = performance.now() - lastInteractionRef.current;
    const documentVisible = typeof document === "undefined" || document.visibilityState !== "hidden";
    controls.autoRotate =
      !hoveredKey &&
      !isDraggingRef.current &&
      !paused &&
      !flightRef.current &&
      documentVisible &&
      !reducedMotion &&
      sinceInteraction > AUTO_ROTATE_RESUME_MS;
  });

  const handleBackgroundClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onHoverChange(null);
    onBackgroundClick?.();
  };

  const stopPropagationOnly = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
  };

  const containerSize = useMemo(() => ({ width: size.width, height: size.height }), [size.width, size.height]);

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[-400, 100, 400]} intensity={0.6} />
      <directionalLight position={[-200, 500, 200]} intensity={0.4} />
      <pointLight position={[-200, 500, 200]} intensity={0.5} />

      {globe && <primitive object={globe} />}

      {/* Blocks the raycaster from continuing through the globe to
          far-side pins, which are otherwise pickable because R3F's
          raycasting ignores handler-less objects (like the globe mesh
          itself) instead of respecting the z-buffer. */}
      <mesh
        onPointerOver={stopPropagationOnly}
        onPointerMove={stopPropagationOnly}
        onPointerDown={stopPropagationOnly}
        onPointerUp={stopPropagationOnly}
        onClick={handleBackgroundClick}
      >
        <sphereGeometry args={[OCCLUDER_RADIUS, 32, 32]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <DestinationPins
        items={items}
        selectedKey={selectedKey}
        hoveredKey={hoveredKey}
        onHoverChange={onHoverChange}
        onPinClick={onPinClick}
        pinColor={theme.pinColor}
        pinSelectedColor={theme.pinSelectedColor}
        hoverCardRef={hoverCardRef}
        containerSize={containerSize}
      />

      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableZoom
        enableDamping
        dampingFactor={0.08}
        minDistance={MIN_DISTANCE}
        maxDistance={MAX_DISTANCE}
        minPolarAngle={MIN_POLAR_ANGLE}
        maxPolarAngle={MAX_POLAR_ANGLE}
        autoRotateSpeed={AUTO_ROTATE_SPEED}
        onStart={handleControlsStart}
        onEnd={handleControlsEnd}
      />
    </>
  );
}
