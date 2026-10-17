export const MAX_TIME_SHORTCUTS = 8;

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTime(t: string): boolean {
  return TIME_RE.test(t);
}

export type AddShortcutResult = { ok: true; list: string[] } | { ok: false; error: string };

export function addShortcut(list: string[], t: string): AddShortcutResult {
  if (!isValidTime(t)) return { ok: false, error: "Enter a valid time." };
  if (list.includes(t)) return { ok: false, error: "That time is already in the list." };
  if (list.length >= MAX_TIME_SHORTCUTS) {
    return { ok: false, error: `You can have at most ${MAX_TIME_SHORTCUTS} time shortcuts.` };
  }
  return { ok: true, list: [...list, t].sort() };
}

const FALLBACK_ZONES = ["Europe/London", "Europe/Dublin", "Europe/Paris", "Europe/Madrid", "UTC"];
const PREFIXES = ["Europe/", "America/", "Asia/", "Australia/", "Pacific/", "Africa/"];

export function timezoneOptions(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  if (typeof intl.supportedValuesOf !== "function") return FALLBACK_ZONES;
  try {
    const zones = intl.supportedValuesOf("timeZone").filter((z) => PREFIXES.some((p) => z.startsWith(p)));
    if (zones.length === 0) return FALLBACK_ZONES;
    return zones.includes("UTC") ? zones : [...zones, "UTC"];
  } catch {
    return FALLBACK_ZONES;
  }
}
