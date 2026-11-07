/**
 * The country a form should hold after a destination is picked, or null when
 * nothing needs to change (no destination match, the destination has no
 * country, or the form already holds that country).
 */
export function countryToSetForDestination(
  destinations: ReadonlyArray<{ id: string; country_id: string | null }>,
  destinationId: string,
  currentCountryId: string | null | undefined,
): string | null {
  const countryId = destinations.find((d) => d.id === destinationId)?.country_id ?? null;
  if (!countryId || countryId === currentCountryId) return null;
  return countryId;
}
