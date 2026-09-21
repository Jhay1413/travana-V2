// Geometry helpers for the destination guru globe.
// `latLngToVector3` intentionally mirrors three-globe's internal
// `polar2Cartesian` formula exactly, so pin positions line up with the
// hex-polygon land mass rendered by three-globe.

/** Radius (in scene units) used for the ThreeGlobe instance and all pin math. */
export const GLOBE_RADIUS = 100;

export interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

/**
 * Convert a lat/lng pair to a cartesian position on a sphere of the given
 * radius, matching three-globe's `polar2Cartesian` exactly:
 *   phi = (90 - lat) in radians
 *   theta = (90 - lng) in radians
 *   x = r * sin(phi) * cos(theta)
 *   y = r * cos(phi)
 *   z = r * sin(phi) * sin(theta)
 */
export function latLngToVector3(lat: number, lng: number, radius: number = GLOBE_RADIUS): Vector3Like {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((90 - lng) * Math.PI) / 180;
  const phiSin = Math.sin(phi);

  return {
    x: radius * phiSin * Math.cos(theta),
    y: radius * Math.cos(phi),
    z: radius * phiSin * Math.sin(theta),
  };
}

/**
 * Distance-aware facing test: is the point at `pinPos` visible from
 * `cameraPos` (both relative to the globe's local origin — the globe
 * itself is centered at the origin), given the globe's opaque radius?
 *
 * The true horizon of a sphere of `radius` as seen from a camera at
 * distance `|cameraPos|` is where cos(theta) = radius / |cameraPos| — NOT
 * a fixed angle. A constant dot-product threshold (e.g. cos(87°) ≈ 0.05)
 * is only close to correct at one specific camera distance; at any other
 * distance it either hides pins that are genuinely visible or — worse,
 * since pins render with depthTest: false — lets pins between the true
 * horizon and the fixed threshold paint as ghosts over the globe's near
 * face instead of being occluded. `radius` defaults to the globe's own
 * radius (GLOBE_RADIUS), which is what actually occludes pins regardless
 * of their own small altitude offset above the surface.
 */
export function isFacingCamera(
  pinPos: Vector3Like,
  cameraPos: Vector3Like,
  radius: number = GLOBE_RADIUS,
  margin = 0.02,
): boolean {
  const pinLen = Math.hypot(pinPos.x, pinPos.y, pinPos.z);
  const camLen = Math.hypot(cameraPos.x, cameraPos.y, cameraPos.z);
  if (pinLen === 0 || camLen === 0) return false;

  const dot =
    (pinPos.x * cameraPos.x + pinPos.y * cameraPos.y + pinPos.z * cameraPos.z) / (pinLen * camLen);

  const horizonCos = radius / camLen;
  return dot > horizonCos + margin;
}

/**
 * Shortest signed delta (in degrees) from `a` to `b`, taking the
 * antimeridian into account, e.g. shortestLngDelta(170, -170) === 20
 * (not -340).
 */
export function shortestLngDelta(a: number, b: number): number {
  let delta = (b - a) % 360;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta;
}

/**
 * Camera position for looking straight down at (lat, lng) from `distance`
 * units away from the globe's center — i.e. the point along the
 * lat/lng surface normal, scaled out to `distance`.
 */
export function cameraPositionFor(lat: number, lng: number, distance: number): Vector3Like {
  return latLngToVector3(lat, lng, distance);
}
