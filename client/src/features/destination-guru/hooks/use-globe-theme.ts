import { useEffect, useState } from "react";
import { parseHslTriplet, type HslTriplet } from "../lib/theme-color";

export interface GlobeTheme {
  /** three.js Color-compatible CSS string for the globe's base material. */
  globeColor: string;
  /** CSS color for the hex-polygon land mass outlines. */
  polygonColor: string;
  /** CSS color for the atmosphere glow. */
  atmosphereColor: string;
  /** CSS color for unselected pins. */
  pinColor: string;
  /** CSS color for the selected pin. */
  pinSelectedColor: string;
  /** Gradient stops for the dark "stage" background behind the canvas. */
  stageFrom: string;
  stageTo: string;
}

// Sane fallback (a blue close to the app's default --primary) used when the
// CSS variable is missing or unparsable.
const FALLBACK_HSL: HslTriplet = { h: 217, s: 91, l: 60 };
const PIN_SELECTED_COLOR = "#f59e0b";

function buildGlobeTheme({ h, s, l }: HslTriplet): GlobeTheme {
  return {
    globeColor: `hsl(${h}, ${(s * 0.6).toFixed(1)}%, 12%)`,
    polygonColor: "rgba(255, 255, 255, 0.7)",
    atmosphereColor: `hsl(${h}, ${s}%, ${Math.min(l + 20, 85)}%)`,
    pinColor: `hsl(${h}, ${s}%, ${l}%)`,
    pinSelectedColor: PIN_SELECTED_COLOR,
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
