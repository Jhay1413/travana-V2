const OPERATOR_KEYS = new Set(['main_tour_operator_id', 'tour_operator_id', 'tourOperatorId']);
const MAX_DEPTH = 6;

/**
 * Collects every tour-operator id found anywhere in a quote/booking payload
 * (main operator plus each line item's operator, snake_case or camelCase),
 * de-duplicated. Null, empty and non-string values are ignored.
 */
export function collectTourOperatorIds(payload: unknown): string[] {
  const found = new Set<string>();
  const walk = (node: unknown, depth: number): void => {
    if (depth > MAX_DEPTH || node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (OPERATOR_KEYS.has(key)) {
        if (typeof value === 'string' && value.trim() !== '') found.add(value);
      } else {
        walk(value, depth + 1);
      }
    }
  };
  walk(payload, 0);
  return Array.from(found);
}
