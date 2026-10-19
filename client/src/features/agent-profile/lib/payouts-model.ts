import type { PillTone } from "@/features/admin-dashboard";
import type { AgentProfilePayoutRow } from "../types";
import { MONTH_NAMES, parseKey } from "./dates";

const STATUS: Record<AgentProfilePayoutRow["status"], { label: string; tone: PillTone }> = {
  due: { label: "Due", tone: "warn" },
  draft: { label: "Draft", tone: "plain" },
  paid: { label: "Paid", tone: "good" },
};

export interface PayoutView {
  key: string;
  month: string;
  sub: string;
  amount: number | null;
  statusLabel: string;
  tone: PillTone;
}

function toAmount(value: string): number | null {
  const n = Number(value);
  return value !== "" && Number.isFinite(n) ? n : null;
}

/** One table row per statement. The live current-month row reads "so far"; no pay day is invented. */
export function buildPayoutViews(rows: readonly AgentProfilePayoutRow[]): PayoutView[] {
  return rows.map((r) => {
    const p = parseKey(r.periodStart);
    const s = STATUS[r.status];
    return {
      key: `${r.periodStart}-${r.live ? "live" : "stored"}`,
      month: `${MONTH_NAMES[p.month - 1]} ${p.year}`,
      sub: r.live ? "Month so far" : `${Number(r.sharePercent)}% to the homeworker`,
      amount: toAmount(r.homeworkerShare),
      statusLabel: s.label,
      tone: s.tone,
    };
  });
}

/** "Monthly, at a 70/30 split" without a pay day; null share gives the plain line. */
export function payoutsSubtitle(sharePercent: string | null): string {
  const n = sharePercent === null ? NaN : Number(sharePercent);
  if (!Number.isFinite(n)) return "Monthly.";
  return `Monthly, at a ${n}/${100 - n} split.`;
}
