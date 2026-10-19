import type { DocumentEntry } from "@/features/hr";
import type { PillTone } from "@/features/admin-dashboard";
import { dayKeyOf, dayOf, daysBetween, formatDay } from "./dates";
import { plural } from "./money";

/** Documents are flagged this many days before they expire. */
export const EXPIRY_WARNING_DAYS = 60;

export type ExpiryStatus = "valid" | "soon" | "expired";

export interface ExpiryRow {
  id: string;
  name: string;
  expiresAt: string;
  status: ExpiryStatus;
  pillLabel: string;
  tone: PillTone;
  text: string;
}

const PILL: Record<ExpiryStatus, { label: string; tone: PillTone }> = {
  valid: { label: "Valid", tone: "info" },
  soon: { label: "Expiring soon", tone: "warn" },
  expired: { label: "Expired", tone: "bad" },
};

export function classifyExpiry(expiresAt: string, todayKey: string): { status: ExpiryStatus; daysLeft: number; text: string } {
  const key = dayOf(expiresAt);
  const daysLeft = daysBetween(todayKey, key);
  if (daysLeft < 0) return { status: "expired", daysLeft, text: `Expired ${formatDay(key)}` };
  const when = daysLeft === 0 ? "today" : `in ${plural(daysLeft, "day")}`;
  return { status: daysLeft <= EXPIRY_WARNING_DAYS ? "soon" : "valid", daysLeft, text: `Expires ${formatDay(key)}, ${when}` };
}

/** Documents that have an expiry date, soonest first (expired ones come first). */
export function expiringDocuments(documents: readonly DocumentEntry[], todayKey: string): ExpiryRow[] {
  return documents
    .filter((d): d is DocumentEntry & { expiresAt: string } => !!d.expiresAt)
    .map((d) => {
      const c = classifyExpiry(d.expiresAt, todayKey);
      return { id: d.id, name: d.name, expiresAt: dayOf(d.expiresAt), status: c.status, pillLabel: PILL[c.status].label, tone: PILL[c.status].tone, text: c.text };
    })
    .sort((a, b) => (a.expiresAt < b.expiresAt ? -1 : a.expiresAt > b.expiresAt ? 1 : 0));
}

export interface DocumentStatusView {
  label: string;
  tone: PillTone;
  /** Right-hand column: expiry wording when there is an expiry date, else when it was uploaded. */
  date: string;
}

/** Status pill and date for a row in "Agreement and documents". Expiry wins over the stored status. */
export function documentStatusView(doc: DocumentEntry, todayKey: string): DocumentStatusView {
  if (doc.expiresAt) {
    const c = classifyExpiry(doc.expiresAt, todayKey);
    return { label: PILL[c.status].label, tone: PILL[c.status].tone, date: c.text };
  }
  const date = doc.uploadedAt ? `Added ${formatDay(dayKeyOf(doc.uploadedAt))}` : "—";
  if (doc.status === "Missing") return { label: "Missing", tone: "bad", date };
  if (doc.status === "Expiring Soon") return { label: "Expiring soon", tone: "warn", date };
  return { label: "On file", tone: "good", date };
}
