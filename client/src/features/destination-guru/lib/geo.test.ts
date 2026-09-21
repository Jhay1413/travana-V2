import { describe, expect, it } from "vitest";
import {
  GLOBE_RADIUS,
  cameraPositionFor,
  isFacingCamera,
  latLngToVector3,
  shortestLngDelta,
} from "./geo";

function closeTo(value: number, target: number, epsilon = 1e-9) {
  expect(Math.abs(value - target)).toBeLessThan(epsilon);
}

describe("latLngToVector3", () => {
  it("places (0, 0) on the +z axis", () => {
    const v = latLngToVector3(0, 0, 100);
    closeTo(v.x, 0);
    closeTo(v.y, 0);
    closeTo(v.z, 100);
  });

  it("places the north pole (90, any) on the +y axis", () => {
    const v = latLngToVector3(90, 42, 100);
    closeTo(v.x, 0);
    closeTo(v.y, 100);
    closeTo(v.z, 0);
  });

  it("places (0, 90) on the +x axis", () => {
    const v = latLngToVector3(0, 90, 100);
    closeTo(v.x, 100);
    closeTo(v.y, 0);
    closeTo(v.z, 0);
  });

  it("places Corfu (39.6243, 19.9217) at the expected cartesian position", () => {
    const lat = 39.6243;
    const lng = 19.9217;
    const v = latLngToVector3(lat, lng, GLOBE_RADIUS);

    const phi = ((90 - lat) * Math.PI) / 180;
    const theta = ((90 - lng) * Math.PI) / 180;
    const phiSin = Math.sin(phi);

    closeTo(v.x, GLOBE_RADIUS * phiSin * Math.cos(theta));
    closeTo(v.y, GLOBE_RADIUS * Math.cos(phi));
    closeTo(v.z, GLOBE_RADIUS * phiSin * Math.sin(theta));

    // Sanity: the resulting point lies on the sphere of radius GLOBE_RADIUS.
    const dist = Math.hypot(v.x, v.y, v.z);
    closeTo(dist, GLOBE_RADIUS, 1e-6);

    // Northern hemisphere -> positive y.
    expect(v.y).toBeGreaterThan(0);
  });

  it("defaults to GLOBE_RADIUS when no radius is provided", () => {
    const v = latLngToVector3(0, 0);
    closeTo(v.z, GLOBE_RADIUS);
  });
});

describe("isFacingCamera", () => {
  it("treats a pin directly under the camera as facing (near side)", () => {
    const cameraPos = { x: 0, y: 0, z: 300 };
    const pinPos = latLngToVector3(0, 0, 100);
    expect(isFacingCamera(pinPos, cameraPos)).toBe(true);
  });

  it("treats a pin on the opposite side of the globe as not facing (far side)", () => {
    const cameraPos = { x: 0, y: 0, z: 300 };
    const pinPos = latLngToVector3(0, 180, 100);
    expect(isFacingCamera(pinPos, cameraPos)).toBe(false);
  });

  it("hides a pin exactly at the geometric limb regardless of camera distance", () => {
    // A pin 90 degrees around from the camera direction sits right at the
    // limb (dot === 0), which is always behind the true horizon
    // (horizonCos = radius / camLen is always > 0 for a camera outside the
    // globe), so this must be hidden at any distance.
    const pinPos = latLngToVector3(0, 90, 100);
    expect(isFacingCamera(pinPos, { x: 0, y: 0, z: 150 })).toBe(false);
    expect(isFacingCamera(pinPos, { x: 0, y: 0, z: 300 })).toBe(false);
    expect(isFacingCamera(pinPos, { x: 0, y: 0, z: 420 })).toBe(false);
  });

  it("the true horizon moves with camera distance: a pin at 60 degrees is hidden when close, visible when far", () => {
    // horizonCos(d) = GLOBE_RADIUS / d.
    // At d=150: horizonCos = 100/150 ≈ 0.667 -> horizon angle ≈ 48.2°.
    //   A pin 60° from the camera axis (cos60° = 0.5) is beyond that horizon -> hidden.
    // At d=300: horizonCos = 100/300 ≈ 0.333 -> horizon angle ≈ 70.5°.
    //   The same 60° pin (cos60° = 0.5) is now within the horizon -> visible.
    const lngFor60Degrees = 60; // (0, 0) is the camera-axis point, longitude is the angle around it here.
    const pinPos = latLngToVector3(0, lngFor60Degrees, 100);

    expect(isFacingCamera(pinPos, { x: 0, y: 0, z: 150 })).toBe(false);
    expect(isFacingCamera(pinPos, { x: 0, y: 0, z: 300 })).toBe(true);
  });

  it("a constant fixed-angle threshold would have gotten the d=150 case wrong", () => {
    // Sanity check that this isn't a no-op: cos(60°) = 0.5 is well above the
    // old fixed margin (0.05), so the old implementation would have wrongly
    // reported this pin as facing (a "ghost" pin) at close zoom.
    const pinPos = latLngToVector3(0, 60, 100);
    const cameraPos = { x: 0, y: 0, z: 150 };
    const pinLen = Math.hypot(pinPos.x, pinPos.y, pinPos.z);
    const camLen = Math.hypot(cameraPos.x, cameraPos.y, cameraPos.z);
    const dot = (pinPos.x * cameraPos.x + pinPos.y * cameraPos.y + pinPos.z * cameraPos.z) / (pinLen * camLen);
    expect(dot).toBeGreaterThan(0.05);
    expect(isFacingCamera(pinPos, cameraPos)).toBe(false);
  });
});

describe("shortestLngDelta", () => {
  it("computes a simple delta with no antimeridian crossing", () => {
    expect(shortestLngDelta(10, 30)).toBeCloseTo(20);
    expect(shortestLngDelta(30, 10)).toBeCloseTo(-20);
  });

  it("takes the shortest path across the antimeridian", () => {
    expect(shortestLngDelta(170, -170)).toBeCloseTo(20);
    expect(shortestLngDelta(-170, 170)).toBeCloseTo(-20);
  });

  it("returns 0 for identical longitudes", () => {
    expect(shortestLngDelta(45, 45)).toBeCloseTo(0);
  });
});

describe("cameraPositionFor", () => {
  it("returns a position at the requested distance from the origin", () => {
    const pos = cameraPositionFor(39.6243, 19.9217, 300);
    const dist = Math.hypot(pos.x, pos.y, pos.z);
    closeTo(dist, 300, 1e-6);
  });

  it("matches latLngToVector3 scaled to the given distance", () => {
    const pos = cameraPositionFor(10, 20, 250);
    const expected = latLngToVector3(10, 20, 250);
    closeTo(pos.x, expected.x);
    closeTo(pos.y, expected.y);
    closeTo(pos.z, expected.z);
  });
});
