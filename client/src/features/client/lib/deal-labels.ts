import type { DealLabelLookup } from "@/features/client/types";
import { dealDeepLinkHref } from "@/lib/deal-links";

interface LabelEnquiry {
  id: string;
  transaction_id?: string | null;
  title?: string | null;
  travel_date?: string | null;
}

interface LabelQuote extends LabelEnquiry {
  isQuoteCopy?: boolean | null;
  date_created?: string | null;
}

interface LabelBooking extends LabelEnquiry {}

export type TaskHolidayKind = "enquiry" | "quote" | "booking";

export interface TaskHolidayInfo {
  kind: TaskHolidayKind;
  title: string | null;
  travelDate: string | null;
}

/** Deal title + travel date by id, so a task row can say which holiday it is for. */
export function buildTaskHolidays(
  enquiries: LabelEnquiry[],
  quotes: LabelEnquiry[],
  bookings: LabelEnquiry[],
): Map<string, TaskHolidayInfo> {
  const map = new Map<string, TaskHolidayInfo>();
  const groups: Array<[TaskHolidayKind, LabelEnquiry[]]> = [["enquiry", enquiries], ["quote", quotes], ["booking", bookings]];
  for (const [kind, list] of groups) {
    for (const d of list) map.set(d.id, { kind, title: d.title ?? null, travelDate: d.travel_date ?? null });
  }
  return map;
}

/**
 * Where a task row on the client page should navigate: the holiday the task is
 * attached to. The kind comes from LOOKING THE ID UP in the client's holidays
 * (booking tasks are stored as entityType "quote" with the booking id), never
 * from the stored entityType. Client-only tasks and unknown ids get no link.
 */
export function taskLinkFor(
  task: { entityId?: string | null },
  holidays: Map<string, TaskHolidayInfo>,
  clientId: string,
): string | null {
  if (!task.entityId || !clientId) return null;
  const holiday = holidays.get(task.entityId);
  if (!holiday) return null;
  return dealDeepLinkHref(holiday.kind, task.entityId, clientId);
}

/**
 * transaction_id -> deal label, so a note written on one of the client's deals
 * can carry a pill naming it. The label reflects the deal's CURRENT stage:
 * booking beats quote beats enquiry. A transaction can hold several quote
 * variants; the primary (non-copy) wins, then the most recently created.
 */
export function buildDealLabels(
  enquiries: LabelEnquiry[],
  quotes: LabelQuote[],
  bookings: LabelBooking[],
): DealLabelLookup {
  const map: DealLabelLookup = new Map();

  for (const e of enquiries) {
    if (e.transaction_id) map.set(e.transaction_id, { kind: "enquiry", id: e.id, title: e.title || "Untitled enquiry" });
  }

  const quotesByTransaction = new Map<string, LabelQuote[]>();
  for (const q of quotes) {
    if (!q.transaction_id) continue;
    const group = quotesByTransaction.get(q.transaction_id);
    if (group) group.push(q);
    else quotesByTransaction.set(q.transaction_id, [q]);
  }
  for (const [transactionId, group] of quotesByTransaction) {
    const winner = [...group].sort((a, b) => {
      const primaryDiff = Number(a.isQuoteCopy === false ? 0 : 1) - Number(b.isQuoteCopy === false ? 0 : 1);
      if (primaryDiff !== 0) return primaryDiff;
      return new Date(b.date_created || 0).getTime() - new Date(a.date_created || 0).getTime();
    })[0];
    map.set(transactionId, { kind: "quote", id: winner.id, title: winner.title || "Untitled quote" });
  }

  for (const b of bookings) {
    if (b.transaction_id) map.set(b.transaction_id, { kind: "booking", id: b.id, title: b.title || "Untitled booking" });
  }

  return map;
}
