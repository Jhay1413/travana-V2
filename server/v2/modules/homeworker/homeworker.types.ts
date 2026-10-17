import type { Branch, HomeworkerPayoutStatement, InsertBranch, InsertUser, User } from '@shared/schema';
import type { RequestActor } from '../../utils/request-actor';

export type HomeworkerStatus = 'pending' | 'active' | 'suspended' | 'archived';

/** Percent accepted from clients: a number or a decimal string, normalised by the service. */
export type ProfitSharePercentInput = number | string;

export interface InviteHomeworkerInput {
  email:               string;
  firstName?:          string;
  lastName?:           string;
  profitSharePercent?: ProfitSharePercentInput;
  displayName?:        string;
}

/** Caller identity; either orgRoles (full union) or orgRole must be provided. */
export interface HomeworkerActor {
  orgId:     string;
  userId:    string | null;
  orgRole:   string;
  orgRoles?: string[];
  /** Who is acting, for the audit log; absent in unit tests. */
  requestActor?: RequestActor;
}

export interface InviteHomeworkerResult {
  userId:    string;
  branchId:  string;
  email:     string;
  expiresAt: Date;
}

export interface UpdateHomeworkerInput {
  profitSharePercent?: ProfitSharePercentInput;
  name?:               string;
}

export interface OrgHomeworkerDefaults {
  name:                 string;
  homeworkerCommission: number | null;
}

export interface HomeworkerListRow {
  branchId:           string;
  name:               string;
  isActive:           boolean;
  profitSharePercent: string | null;
  createdAt:          Date;
  ownerUserId:        string;
  ownerName:          string;
  ownerEmail:         string;
  inviteToken:        string | null;
  memberIsActive:     boolean | null;
}

export interface HomeworkerListItem {
  branchId:           string;
  name:               string;
  status:             HomeworkerStatus;
  profitSharePercent: string | null;
  createdAt:          Date;
  owner:              { userId: string; name: string; email: string };
}

export interface CreateHomeworkerRecords {
  userValues:   InsertUser;
  branchValues: Omit<InsertBranch, 'ownerUserId'>;
}

export interface CreatedHomeworker {
  user:   User;
  branch: Branch;
}

export interface StatementTotals {
  gross:           string;
  homeworkerShare: string;
  orgShare:        string;
  bookingCount:    number;
}

/** Booking row (repository shape): commission - discounts - service charge = net. */
export interface StatementBookingRow {
  bookingId:     string;
  transactionId: string;
  clientName:    string | null;
  dateCreated:   Date | null;
  commission:    string;
  discounts:     string;
  serviceCharge: string;
  net:           string;
}

/** Upsell row (repository shape): commission recognised by its own added_at. */
export interface StatementUpsellRow {
  bookingId:     string;
  transactionId: string;
  clientName:    string | null;
  addedAt:       Date | null;
  upsellType:    string;
  amount:        string;
}

export type StatementBookingLine = StatementBookingRow & { type: 'booking' };
export type StatementUpsellLine = StatementUpsellRow & { type: 'upsell' };
/** Detail line: booking nets plus upsell amounts add up to the period gross (before the zero clamp). */
export type StatementLine = StatementBookingLine | StatementUpsellLine;

export interface FinaliseStatementRecord {
  orgId:           string;
  branchId:        string;
  userId:          string | null;
  periodStart:     string;
  periodEnd:       string;
  /** Last day covered (periodEnd - 1 day); audit/display only, not stored on the statement row. */
  periodEndInclusive: string;
  grossProfit:     string;
  sharePercent:    string;
  homeworkerShare: string;
  orgShare:        string;
  finalisedBy:     string | null;
  auditName:       string | null;
}

/**
 * Period as stored: [from, to). `to` is EXCLUSIVE (it is also what is stored in
 * homeworker_payout_statement.period_end). `periodEndInclusive` (to minus one day)
 * is the last day covered and is for display only.
 */
/** Repository outcome of storing a statement: the service maps `duplicate` to a 409. */
export type InsertStatementResult =
  | { status: 'created'; row: HomeworkerPayoutStatement }
  | { status: 'duplicate' };

export interface StatementPeriod {
  from: string;
  to:   string;
}

export interface StatementResultPeriod extends StatementPeriod {
  periodEndInclusive: string;
}

export interface StatementResult {
  branch:          { id: string; name: string; ownerUserId: string | null; profitSharePercent: string | null };
  period:          StatementResultPeriod;
  /**
   * When `finalised` is set, gross / sharePercent / homeworkerShare / orgShare are the
   * FROZEN figures from the stored statement (what is actually paid). Otherwise they
   * are live. `liveGross` is always the freshly computed gross; `driftWarning` is true
   * when a finalised statement exists and its frozen gross differs from `liveGross`
   * (bookings or upsells changed after finalise), so the client can show "figures
   * changed since finalise". `bookingCount` and `lines` are always live. Edits after
   * finalise are not blocked; this flag is the detection mechanism.
   */
  gross:           string;
  liveGross:       string;
  driftWarning:    boolean;
  sharePercent:    string;
  homeworkerShare: string;
  orgShare:        string;
  bookingCount:    number;
  lines:           StatementLine[];
  /** The stored statement for exactly this period (frozen figures), or null. */
  finalised:       HomeworkerPayoutStatement | null;
}
