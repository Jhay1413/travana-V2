import { contrastRatio, hexToHslTriple } from "@/lib/color";

/** The portal's neutral navy, used when an agency has no (usable) brand colour. */
export const PORTAL_NAVY = "#002c60";
/** The portal's page background. A brand colour too close to it would vanish. */
export const PORTAL_CREAM = "#fbf3ea";

const WHITE = "#ffffff";
const INK = "#1b2433";

/** WCAG AA for normal text. */
export const AA_TEXT = 4.5;
/** Below this against the cream page a colour reads as "almost the background". */
export const MIN_CONTRAST_WITH_CREAM = 3;

export type BrandMode =
  /** The brand colour is dark enough to carry white text and stand out on cream: it drives large surfaces. */
  | "brand-surface"
  /** Too light, or too close to cream: large surfaces stay navy and the brand colour only accents. */
  | "navy-with-accent";

export interface BrandPalette {
  mode: BrandMode;
  /** `#rrggbb` for large surfaces and primary buttons. */
  primary: string;
  /** Readable text colour on `primary`. */
  primaryForeground: string;
  /** The brand colour when it may only accent (navy-with-accent); null otherwise. */
  accent: string | null;
}

/** Normalises `#abc` / `#aabbcc` / `aabbcc` to lower-case `#rrggbb`, or null. */
export function normaliseHex(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.trim().replace(/^#/, "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  return /^[0-9a-fA-F]{6}$/.test(full) ? `#${full.toLowerCase()}` : null;
}

/** Whichever of white or ink reads better on this colour. */
export function readableForeground(hex: string): string {
  const onWhite = contrastRatio(hex, WHITE) ?? 0;
  const onInk = contrastRatio(hex, INK) ?? 0;
  return onWhite >= onInk ? WHITE : INK;
}

/**
 * Decides how an agency's brand colour may be used.
 *  - Unusable or missing → neutral navy.
 *  - Too light to carry white text (contrast with white < 4.5), or too close to the
 *    cream background (contrast with cream < 3) → surfaces stay navy; the colour is an accent only.
 *  - Otherwise the colour drives large surfaces.
 */
export function resolveBrandPalette(brandColor: string | null | undefined): BrandPalette {
  const navy: BrandPalette = { mode: "navy-with-accent", primary: PORTAL_NAVY, primaryForeground: WHITE, accent: null };
  const hex = normaliseHex(brandColor);
  if (!hex) return navy;

  const withWhite = contrastRatio(hex, WHITE) ?? 0;
  const withCream = contrastRatio(hex, PORTAL_CREAM) ?? 0;
  if (withWhite < AA_TEXT || withCream < MIN_CONTRAST_WITH_CREAM) {
    return { ...navy, accent: hex };
  }
  return { mode: "brand-surface", primary: hex, primaryForeground: readableForeground(hex), accent: null };
}

/** The CSS custom properties a palette sets on the portal wrapper. */
export function paletteToCssVars(palette: BrandPalette): Record<string, string> {
  const vars: Record<string, string> = {};
  const primary = hexToHslTriple(palette.primary);
  const foreground = hexToHslTriple(palette.primaryForeground);
  if (primary) {
    vars["--primary"] = primary;
    vars["--secondary-foreground"] = primary;
  }
  if (foreground) vars["--primary-foreground"] = foreground;
  if (palette.accent) {
    const accent = hexToHslTriple(palette.accent);
    if (accent) vars["--portal-brand-accent"] = accent;
  }
  return vars;
}
