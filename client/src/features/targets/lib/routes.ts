export type TargetsTab = "business" | "shops" | "agents" | "homeworkers";

export const TARGETS_BASE = "/agency/targets";
export const BRANCH_TARGETS_PATH = "/branch/targets";
export const MY_TARGETS_PATH = "/my-targets";

export const TAB_ORDER: TargetsTab[] = ["business", "shops", "agents", "homeworkers"];

export const TAB_LABEL: Record<TargetsTab, string> = {
  business: "Business",
  shops: "Shops",
  agents: "Agents",
  homeworkers: "Homeworkers",
};

/** Which tab a pathname under /agency/targets shows. Unknown sub-paths fall back to Business. */
export function tabFromPath(pathname: string): TargetsTab {
  const rest = pathname.replace(/\/+$/, "").slice(TARGETS_BASE.length).replace(/^\//, "");
  return TAB_ORDER.includes(rest as TargetsTab) ? (rest as TargetsTab) : "business";
}

export const isAllocatePath = (pathname: string): boolean => pathname.replace(/\/+$/, "") === `${TARGETS_BASE}/allocate`;

/** A year from a query string, or the fallback when absent or silly. */
export function parseYear(search: string, fallback: number): number {
  const raw = new URLSearchParams(search).get("year");
  const year = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : fallback;
}

export function tabPath(tab: TargetsTab, year: number, currentYear: number): string {
  const base = tab === "business" ? TARGETS_BASE : `${TARGETS_BASE}/${tab}`;
  return year === currentYear ? base : `${base}?year=${year}`;
}

export function wizardPath(opts: { step?: number; branchId?: string | null; year: number; currentYear: number }): string {
  const params = new URLSearchParams();
  if (opts.step && opts.step > 1) params.set("step", String(opts.step));
  if (opts.branchId) params.set("shop", opts.branchId);
  if (opts.year !== opts.currentYear) params.set("year", String(opts.year));
  const qs = params.toString();
  return `${TARGETS_BASE}/allocate${qs ? `?${qs}` : ""}`;
}

/** Years offered in the picker: last year, this year and next. */
export const yearOptions = (currentYear: number): number[] => [currentYear - 1, currentYear, currentYear + 1];
