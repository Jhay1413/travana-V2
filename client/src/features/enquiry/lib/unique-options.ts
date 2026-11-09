export interface LabelledOption {
  value: string;
  label: string;
}

const key = (label: string): string => label.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Lookup tables can hold two rows with the same name (e.g. two "Half Board" board bases).
 * Shows each name once, in first-seen order. When one of the duplicates is already selected,
 * that one is kept, so a saved enquiry pointing at the "other" duplicate still shows as chosen.
 */
export function uniqueOptionsByLabel<T extends LabelledOption>(options: readonly T[], selected: readonly string[] = []): T[] {
  const picked = new Map<string, T>();
  for (const o of options) {
    const k = key(o.label);
    const current = picked.get(k);
    if (!current || (!selected.includes(current.value) && selected.includes(o.value))) picked.set(k, o);
  }
  return [...picked.values()];
}
