import { useEffect, useState } from "react";
import { parseHslTriplet, type HslTriplet } from "../lib/theme-color";

export interface GlobeTheme {
  /** three.js Color-compatible CSS string for the ocean / base globe material. */
  globeColor: string;
  /** CSS color for filled country land (polygonCapColor). */
  landColor: string;
  /** CSS color for country border strokes (polygonStrokeColor). */
  borderColor: string;
  /** CSS color for unselected pins. */
  pinColor: string;
  /** CSS color for the selected pin. */
  pinSelectedColor: string;
  /** Dark, background-agnostic outline behind every pin for contrast on both the ocean and the light land fill. */
  pinOutlineColor: string;
  /** Light halo behind the dark outline, so pins near the limb stay visible against the dark stage peeking around the globe's edge. */
  pinHaloColor: string;
  /** Very subtle rim-light colour softening the globe's limb against the dark stage (GlowMesh sits outside the sphere, doesn't touch land/border rendering). */
  atmosphereColor: string;
  /** Gradient stops for the "stage" background behind the canvas. */
  stageFrom: string;
  stageTo: string;
}

// Sane fallback (a blue close to the app's default --primary) used when the
// CSS variable is missing or unparsable.
const FALLBACK_HSL: HslTriplet = { h: 217, s: 91, l: 60 };
const PIN_SELECTED_COLOR = "#f59e0b";
const PIN_OUTLINE_COLOR = "#111827";
const PIN_HALO_COLOR = "#f8fafc";

// A classic atlas ocean-blue hue. The actual ocean hue leans mostly toward
// this (rather than the raw brand hue) so the map still reads as "water"
// even for brand colors far from blue — while still nudging toward the
// brand hue for some tenant personality (`keeping brand tinting`).
const MAP_OCEAN_HUE = 205;
const OCEAN_HUE_BLEND = 0.65; // 0 = pure brand hue, 1 = pure map-blue

/** Shortest-path circular blend between two hues (0-360deg), t in [0,1]. */
function blendHue(a: number, b: number, t: number): number {
  // Shortest signed delta from a to b, normalized to [-180, 180).
  const diff = (((b - a + 180) % 360) + 360) % 360 - 180;
  return (a + diff * t + 360) % 360;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function buildGlobeTheme({ h, s }: HslTriplet): GlobeTheme {
  const oceanHue = blendHue(h, MAP_OCEAN_HUE, OCEAN_HUE_BLEND);
  const oceanSaturation = clamp(30 + s * 0.15, 30, 45);

  // Pins carry the brand hue (the one clearly "branded" accent against an
  // otherwise neutral atlas palette), but saturation/lightness are fixed
  // (not derived from the tenant's actual --primary lightness) so a very
  // light or washed-out brand color can never produce a pin that blends
  // into the light land fill.
  const pinHueSaturation = clamp(s, 55, 90);
  const pinLightness = 45;

  return {
    globeColor: `hsl(${oceanHue.toFixed(1)}, ${oceanSaturation.toFixed(1)}%, 52%)`,
    // Classic atlas parchment: light, warm, and intentionally neutral
    // (not brand-derived) so it stays legible as "land" regardless of
    // the tenant's brand hue.
    landColor: "hsl(40, 30%, 88%)",
    // A warm umber border — visible but not harsh — completing the atlas
    // palette started by the land fill.
    borderColor: "hsl(32, 28%, 34%)",
    pinColor: `hsl(${h}, ${pinHueSaturation.toFixed(1)}%, ${pinLightness}%)`,
    pinSelectedColor: PIN_SELECTED_COLOR,
    pinOutlineColor: PIN_OUTLINE_COLOR,
    pinHaloColor: PIN_HALO_COLOR,
    // Soft pale tint of the ocean hue — just enough to round off the
    // globe's silhouette against the dark stage, not a "planet in space"
    // glow (kept subtle via a low atmosphereAltitude in globe-scene.tsx).
    atmosphereColor: `hsl(${oceanHue.toFixed(1)}, 45%, 82%)`,
    // Restored dark brand-tinted "space" stage (the light-stage experiment
    // was reverted — the map globe itself stays light, only the page
    // background behind it goes back to dark).
    stageFrom: `hsl(${h} 45% 10%)`,
    stageTo: `hsl(${h} 50% 5%)`,
  };
}

function readPrimaryHsl(): HslTriplet {
  if (typeof document === "undefined") return FALLBACK_HSL;
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--primary");
  return parseHslTriplet(raw) ?? FALLBACK_HSL;
}

/**
 * Derives the globe's colour palette from the app's `--primary` CSS
 * variable (overridden per-org at runtime by branding-applier.tsx, which
 * writes inline styles onto <html>). Re-computes whenever that inline
 * style changes, via a MutationObserver.
 */
export function useGlobeTheme(): GlobeTheme {
  const [theme, setTheme] = useState<GlobeTheme>(() => buildGlobeTheme(readPrimaryHsl()));

  useEffect(() => {
    if (typeof document === "undefined") return;

    const update = () => setTheme(buildGlobeTheme(readPrimaryHsl()));
    update();

    const observer = new MutationObserver((mutations) => {
      const styleChanged = mutations.some(
        (mutation) => mutation.type === "attributes" && mutation.attributeName === "style",
      );
      if (styleChanged) update();
    });

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
    return () => observer.disconnect();
  }, []);

  return theme;
}
