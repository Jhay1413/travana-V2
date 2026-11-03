import type { HomeworkerStatus } from "../types";

export interface StatusChip {
  label: string;
  className: string;
}

const CHIPS: Record<HomeworkerStatus, StatusChip> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  active: { label: "Active", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" },
  suspended: { label: "Suspended", className: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300" },
  archived: { label: "Archived", className: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-white/60" },
};

export function statusChip(status: HomeworkerStatus): StatusChip {
  return CHIPS[status];
}

/** Archive is only valid for accepted homeworkers (pending invites are revoked instead). */
export function canArchive(status: HomeworkerStatus): boolean {
  return status === "active" || status === "suspended";
}
