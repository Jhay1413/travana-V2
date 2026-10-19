import type { ProfileTab } from "../types";

export interface ProfileTabDef {
  value: ProfileTab;
  label: string;
  /** Managers only: shown with a lock. */
  locked?: boolean;
}

export const PROFILE_TABS: readonly ProfileTabDef[] = [
  { value: "overview", label: "Overview" },
  { value: "earnings", label: "Earnings for the company" },
  { value: "training", label: "Training and attendance" },
  { value: "hr", label: "HR", locked: true },
  { value: "pipeline", label: "Pipeline" },
];

export function isProfileTab(value: string | null | undefined): value is ProfileTab {
  return PROFILE_TABS.some((t) => t.value === value);
}

/** An unknown or missing segment is the Overview. */
export function tabFromParam(value: string | null | undefined): ProfileTab {
  return isProfileTab(value) ? value : "overview";
}

export function tabPath(agentId: string, tab: ProfileTab): string {
  const base = `/agents/${encodeURIComponent(agentId)}`;
  return tab === "overview" ? base : `${base}/${tab}`;
}

export interface Breadcrumb {
  rootLabel: string;
  rootHref: string;
  parentLabel: string;
  parentHref: string;
}

/** Admins arrive from the Admin Dashboard's team table; branch managers from their branch overview. */
export function breadcrumbFor(isAdmin: boolean): Breadcrumb {
  return isAdmin
    ? { rootLabel: "Admin Dashboard", rootHref: "/agency/overview", parentLabel: "Team performance", parentHref: "/agency/overview" }
    : { rootLabel: "Dashboard", rootHref: "/branch-overview", parentLabel: "Agents", parentHref: "/branch-overview" };
}

/** Where "Edit target" / "Set target" goes. Branch managers split their own shop's target. */
export function targetHref(isAdmin: boolean, isHomeworker: boolean): string {
  if (!isAdmin) return "/branch/targets";
  return isHomeworker ? "/agency/targets/homeworkers" : "/agency/targets/agents";
}

export const MESSAGE_HREF = "/chat";
export const HUB_HREF = "/hub";

/** Second sentence of the HR tab lock line, by viewer. */
export function lockPaySentence(canSeePay: boolean): string {
  return canSeePay
    ? "Pay and payout details are for owners and admins only."
    : "You are viewing as a branch manager, so pay and payout details are hidden.";
}
