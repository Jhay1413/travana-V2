// Parses the CSS-variable HSL triplet format used by shadcn/Tailwind theme
// tokens, e.g. "217 91% 60%" -> { h: 217, s: 91, l: 60 }.
export interface HslTriplet {
  h: number;
  s: number;
  l: number;
}

const HSL_TRIPLET_RE = /^\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%\s*$/;

export function parseHslTriplet(value: string | null | undefined): HslTriplet | null {
  if (!value) return null;

  const match = HSL_TRIPLET_RE.exec(value.trim());
  if (!match) return null;

  const h = Number(match[1]);
  const s = Number(match[2]);
  const l = Number(match[3]);

  if (!Number.isFinite(h) || !Number.isFinite(s) || !Number.isFinite(l)) return null;

  return { h, s, l };
}
