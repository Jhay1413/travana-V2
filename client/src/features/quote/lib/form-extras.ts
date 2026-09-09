import type { ExtrasFormValues } from "@/features/booking/types";

type ExtrasRows = Pick<
  ExtrasFormValues,
  "transfers" | "carHires" | "attractionTickets" | "loungePasses" | "airportParkings" | "extraAccommodations"
>;

/** Number of extra rows (transfers, car hire, …) on a set of form values. */
export function countExtras(values: Partial<ExtrasRows>): number {
  return (
    (values.transfers?.length ?? 0) +
    (values.carHires?.length ?? 0) +
    (values.attractionTickets?.length ?? 0) +
    (values.loungePasses?.length ?? 0) +
    (values.airportParkings?.length ?? 0) +
    (values.extraAccommodations?.length ?? 0)
  );
}
