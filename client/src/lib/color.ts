/** Pure colour helpers shared by the staff branding applier and the customer portal theme. */

export interface HslParts {
  h: number;
  s: number;
  l: number;
}

export interface RgbParts {
  r: number;
  g: number;
  b: number;
}

/** `#rgb` / `#rrggbb` (the `#` is optional) → 0-255 channels, or null when it is not a hex colour. */
export function hexToRgb(hex: string): RgbParts | null {
  const m = hex.trim().replace(/^#/, "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function hexToHslParts(hex: string): HslParts | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

/** The `H S% L%` triple the app's CSS variables hold (used as `hsl(var(--primary))`). */
export function formatHsl(h: number, s: number, l: number): string {
  return `${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}%`;
}

/** Foreground triple for text on a colour of this lightness (the staff app's rule). */
export function pickForegroundHsl(l: number): string {
  return l > 60 ? "240 10% 10%" : "0 0% 100%";
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

/** WCAG contrast ratio between two hex colours (1 to 21), or null when either is not a hex colour. */
export function contrastRatio(a: string, b: string): number | null {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** `#rrggbb` → the `H S% L%` triple, or null for an invalid colour. */
export function hexToHslTriple(hex: string): string | null {
  const parts = hexToHslParts(hex);
  return parts ? formatHsl(parts.h, parts.s, parts.l) : null;
}
