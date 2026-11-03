export type HomeworkerStatus = "pending" | "active" | "suspended" | "archived";

/** GET /homeworkers row. Mirrors server HomeworkerListItem (dates arrive as ISO strings). */
export interface HomeworkerListItem {
  branchId: string;
  name: string;
  status: HomeworkerStatus;
  /** Decimal string "0".."100", or null when no share is set. */
  profitSharePercent: string | null;
  createdAt: string;
  owner: { userId: string; name: string; email: string };
}

/** GET /homeworkers/me. */
export interface HomeworkerMe {
  branchId: string;
  name: string;
  profitSharePercent: string | null;
  isActive: boolean;
}

export interface InviteHomeworkerPayload {
  email: string;
  firstName?: string;
  lastName?: string;
  profitSharePercent?: string;
  displayName?: string;
}

export interface InviteHomeworkerResult {
  userId: string;
  branchId: string;
  email: string;
  expiresAt: string;
}

export interface UpdateHomeworkerPayload {
  profitSharePercent?: string;
  name?: string;
}
