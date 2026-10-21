export type OperatorNames = Readonly<Record<string, string>>;

const PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["main_tour_operator_id", "main_tour_operator_name"],
  ["tour_operator_id", "tour_operator_name"],
];

const MAX_DEPTH = 4;

/** Collects id -> name pairs from a quote/booking record (main operator, line items, upsells). */
export function collectOperatorNames(record: unknown): OperatorNames {
  const names: Record<string, string> = {};
  const walk = (node: unknown, depth: number): void => {
    if (depth > MAX_DEPTH || typeof node !== "object" || node === null) return;
    if (Array.isArray(node)) {
      node.forEach((item) => walk(item, depth + 1));
      return;
    }
    const obj = node as Record<string, unknown>;
    for (const [idKey, nameKey] of PAIRS) {
      const id = obj[idKey];
      const name = obj[nameKey];
      if (typeof id === "string" && id && typeof name === "string" && name.trim()) names[id] = name;
    }
    Object.values(obj).forEach((value) => walk(value, depth + 1));
  };
  walk(record, 0);
  return names;
}
