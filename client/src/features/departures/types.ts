// HTTP contract of /api/v2/departures (mirrors server/v2/modules/departures).
export interface DepartureChecks {
  checkIn: boolean;
  ticketsInHouse: boolean;
  passportInfo: boolean;
  ticketsPickUp: boolean;
  completed: boolean;
  fullyPaid: boolean;
}

export interface DepartureLastChange {
  by: string | null;
  byName: string | null;
  /** ISO instant */
  at: string;
  what: string;
}

export interface DepartureRow {
  bookingId: string;
  transactionId: string;
  clientId: string;
  clientName: string;
  /** Same as clientName. */
  leadPassenger: string;
  /** YYYY-MM-DD */
  travelDate: string;
  nights: number | null;
  title: string | null;
  destination: string | null;
  operatorName: string | null;
  operatorLogoUrl: string | null;
  haysRef: string;
  supplierRef: string;
  checks: DepartureChecks;
  lastChange: DepartureLastChange | null;
}

export type DepartureCheckKey = keyof DepartureChecks;

export interface DepartureSummary {
  days: number;
  upcoming: number;
  notCompleted: number;
  passportMissing: number;
  leavingSoonNotCompleted: number;
  notPaid: number;
  notPaidSoon: number;
}

export interface DepartureListParams {
  /** YYYY-MM-DD, inclusive. Omit for today (London). */
  from?: string;
  /** YYYY-MM-DD, exclusive. */
  to?: string;
}

export type DeparturesTab = "tickets" | "balances";
