export interface DepartureChecks {
  checkIn: boolean;
  ticketsInHouse: boolean;
  passportInfo: boolean;
  ticketsPickUp: boolean;
  completed: boolean;
  fullyPaid: boolean;
}

export type DepartureCheckKey = keyof DepartureChecks;

export interface DepartureLastChange {
  by: string | null;
  byName: string | null;
  /** ISO instant. */
  at: string;
  what: string;
}

export interface DepartureRow {
  bookingId: string;
  transactionId: string;
  clientId: string;
  clientName: string;
  /** Same as clientName: the booking has no separate lead passenger. */
  leadPassenger: string;
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

/** Counts over bookings travelling from today up to and including today + days (London). */
export interface DepartureSummary {
  days: number;
  upcoming: number;
  notCompleted: number;
  passportMissing: number;
  /** Not completed and leaving within 3 days. */
  leavingSoonNotCompleted: number;
  notPaid: number;
  /** Not fully paid and leaving within 7 days. */
  notPaidSoon: number;
}

/** Who may see departures: always an organisation, optionally narrowed to one branch. */
export interface DepartureAccess {
  orgId: string;
  branchId: string | null;
}

/** What the list query reads. `fromYmd` null = no lower date bound; `toExclYmd` null = open-ended. */
export interface DepartureFilter extends DepartureAccess {
  fromYmd: string | null;
  toExclYmd: string | null;
  bookingId?: string;
}

/** One list-query row as the database returns it. */
export interface DepartureRawRow {
  bookingId: string;
  transactionId: string;
  clientId: string;
  firstName: string;
  surename: string;
  travelDate: string;
  nights: number | null;
  title: string | null;
  destination: string | null;
  operatorName: string | null;
  operatorLogoUrl: string | null;
  haysRef: string;
  supplierRef: string;
  checkIn: boolean | null;
  ticketsInHouse: boolean | null;
  passportInfo: boolean | null;
  ticketsPickUp: boolean | null;
  completed: boolean | null;
  fullyPaid: boolean | null;
  lastChangeBy: string | null;
  lastChangeByName: string | null;
  lastChangeAt: Date | null;
  lastChangeWhat: string | null;
}

/** The stored checks row after an upsert. */
export interface StoredChecks extends DepartureChecks {
  lastChangeBy: string | null;
  lastChangeByName: string | null;
  lastChangeAt: Date | null;
  lastChangeWhat: string | null;
}

export interface CheckStamp {
  by: string | null;
  byName: string | null;
  at: Date;
  what: string;
}
