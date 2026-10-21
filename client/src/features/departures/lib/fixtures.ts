import type { DepartureChecks, DepartureRow } from "../types";

export const NO_CHECKS: DepartureChecks = {
  checkIn: false,
  ticketsInHouse: false,
  passportInfo: false,
  ticketsPickUp: false,
  completed: false,
  fullyPaid: false,
};

/** Test helper: a departure row with sensible defaults. */
export function makeRow(over: Partial<Omit<DepartureRow, "checks">> & { checks?: Partial<DepartureChecks> } = {}): DepartureRow {
  const { checks, ...rest } = over;
  return {
    bookingId: "b1",
    transactionId: "t1",
    clientId: "c1",
    clientName: "Alison Whitfield",
    leadPassenger: "Alison Whitfield",
    travelDate: "2026-10-22",
    nights: 7,
    title: null,
    destination: "Lanzarote",
    operatorName: "Jet2holidays",
    operatorLogoUrl: null,
    haysRef: "HAY104821",
    supplierRef: "J2-1",
    lastChange: null,
    ...rest,
    checks: { ...NO_CHECKS, ...checks },
  };
}
