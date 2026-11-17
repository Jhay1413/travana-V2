/** True when the typed search is non-empty and no park name contains it (so "Add Park" is worth offering). */
export function noParkMatchesSearch(parks: { name: string | null }[], search: string): boolean {
  const term = search.trim().toLowerCase();
  if (!term) return false;
  return !parks.some((p) => (p.name ?? "").toLowerCase().includes(term));
}
