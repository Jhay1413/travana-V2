export interface LatLng {
  lat: number;
  lng: number;
}

// Parses a pasted "lat, lng" pair (e.g. copied straight out of Google Maps)
// in a few common formats: "39.62, 19.92", "39.62 19.92", "(39.62, 19.92)".
// Returns null for anything malformed or out of the valid lat/lng range.
export function parseLatLng(input: string): LatLng | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const cleaned = trimmed.replace(/^\(/, "").replace(/\)$/, "").trim();
  const parts = cleaned.split(/[\s,]+/).filter(Boolean);
  if (parts.length !== 2) return null;

  const lat = Number(parts[0]);
  const lng = Number(parts[1]);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90) return null;
  if (lng < -180 || lng > 180) return null;

  return { lat, lng };
}
