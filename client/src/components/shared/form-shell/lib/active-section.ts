export interface SectionOffset {
  id: string;
  /** Section top relative to the scroll container's top, in px. */
  top: number;
}

/** Pure "which section is active" rule used by the scroll spy. */
export function computeActiveSection(sections: readonly SectionOffset[], atBottom: boolean, lockedKey: string | null, threshold = 80): string {
  if (lockedKey && sections.some((s) => s.id === lockedKey)) return lockedKey;
  let active = sections[0]?.id ?? "";
  for (const s of sections) {
    if (s.top <= threshold) active = s.id;
  }
  if (atBottom && sections.length > 0) active = sections[sections.length - 1]?.id ?? active;
  return active;
}
