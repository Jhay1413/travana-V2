/** Booking line: commission - discounts - service charge = net (all decimal strings from the server). */
export interface StatementBookingLine {
  type: "booking";
  bookingId: string;
  transactionId: string;
  clientName: string | null;
  dateCreated: string | null;
  commission: string;
  discounts: string;
  serviceCharge: string;
  net: string;
}

/** Upsell line: commission recognised on its own added-at date. */
export interface StatementUpsellLine {
  type: "upsell";
  bookingId: string;
  transactionId: string;
  clientName: string | null;
  addedAt: string | null;
  upsellType: string;
  amount: string;
}

export type StatementLine = StatementBookingLine | StatementUpsellLine;

/** A frozen statement row (homeworker_payout_statement). */
export interface FinalisedStatement {
  id: string;
  periodStart: string;
  periodEnd: string;
  grossProfit: string;
  sharePercent: string;
  homeworkerShare: string;
  orgShare: string;
  status: "draft" | "final";
  finalisedAt: string | null;
}

export interface StatementResult {
  branch: { id: string; name: string; ownerUserId: string | null; profitSharePercent: string | null };
  /** `to` is EXCLUSIVE; `periodEndInclusive` is the last covered day, for display only. */
  period: { from: string; to: string; periodEndInclusive: string };
  /** When `finalised` is set these four are the FROZEN figures; otherwise live. */
  gross: string;
  sharePercent: string;
  homeworkerShare: string;
  orgShare: string;
  /** Always the freshly computed gross. */
  liveGross: string;
  /** True when a finalised statement exists and its frozen gross differs from liveGross. */
  driftWarning: boolean;
  /** Always live. */
  bookingCount: number;
  lines: StatementLine[];
  /** The stored statement for exactly this period, or null. */
  finalised: FinalisedStatement | null;
}

/** The figures a statement view should display. */
export interface StatementFigures {
  gross: string;
  sharePercent: string;
  homeworkerShare: string;
  orgShare: string;
  frozen: boolean;
}
