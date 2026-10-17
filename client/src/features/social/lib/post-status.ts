export type SocialPostStatus = "not_generated" | "draft" | "scheduled" | "posted";

export interface PostStatusInput {
  dealId?: string | null;
  onlySocialsId?: string | null;
  postSchedule?: string | null;
}

export function derivePostStatus(input: PostStatusInput, now: Date = new Date()): SocialPostStatus {
  if (!input.dealId) return "not_generated";
  if (!input.onlySocialsId) return "draft";
  if (input.postSchedule) {
    const at = new Date(input.postSchedule).getTime();
    if (!Number.isNaN(at) && at > now.getTime()) return "scheduled";
  }
  return "posted";
}

export const STATUS_META: Record<SocialPostStatus, { label: string; plural: string; badgeClass: string }> = {
  not_generated: {
    label: "Not generated",
    plural: "Not generated",
    badgeClass: "bg-status-draft-bg text-status-draft-fg",
  },
  draft: { label: "Draft", plural: "Drafts", badgeClass: "bg-status-draft-bg text-status-draft-fg" },
  scheduled: {
    label: "Scheduled",
    plural: "Scheduled",
    badgeClass: "bg-status-scheduled-bg text-status-scheduled-fg",
  },
  posted: { label: "Posted", plural: "Posted", badgeClass: "bg-status-posted-bg text-status-posted-fg" },
};

export function countByStatus(
  items: readonly PostStatusInput[],
  now: Date = new Date(),
): Record<SocialPostStatus, number> {
  const counts: Record<SocialPostStatus, number> = { not_generated: 0, draft: 0, scheduled: 0, posted: 0 };
  for (const item of items) counts[derivePostStatus(item, now)] += 1;
  return counts;
}
