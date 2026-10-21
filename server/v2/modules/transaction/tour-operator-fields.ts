export interface TourOperatorRow {
  id: string;
  name: string | null;
  logo_url: string | null;
}

export interface TourOperatorFields {
  main_tour_operator_name: string | null;
  main_tour_operator_logo_url: string | null;
}

/** Operator name and logo for a row's main_tour_operator_id (nulls when it has none or the operator is unknown). */
export function tourOperatorFields(
  operatorId: string | null | undefined,
  operators: readonly TourOperatorRow[],
): TourOperatorFields {
  const operator = operatorId ? operators.find((o) => o.id === operatorId) : undefined;
  return { main_tour_operator_name: operator?.name ?? null, main_tour_operator_logo_url: operator?.logo_url ?? null };
}
