/**
 * Where a quote is in its life: Created -> Sent -> Viewed -> Accepted -> Booked.
 * Pure, so the stepper's rules are unit tested.
 *
 * - The current step is the last one that has data; earlier steps are done and
 *   later ones are todo. A booked deal has every step done.
 * - Accepted is either the customer pressing Accept on the public page or an
 *   agent marking it by hand. The customer's action wins, and only a manual
 *   mark can be undone.
 */
import { formatDay, timeAgo } from "./quote-views";

export type QuoteStageId = "created" | "sent" | "viewed" | "accepted" | "booked";
export type QuoteStepState = "done" | "now" | "todo";
export type AcceptedSource = "customer" | "manual";

export interface QuoteStep {
  id: QuoteStageId;
  label: string;
  note: string;
  state: QuoteStepState;
}

export interface QuoteStageInput {
  createdAt: string | null;
  sentAt: string | null;
  viewCount: number;
  lastViewedAt: string | null;
  /** Latest "accepted" action the customer took on the public page. */
  customerAccepted: { at: string; name: string | null } | null;
  /** Manual mark made by an agent. */
  manualAccepted: { at: string; byName: string | null } | null;
  /** The deal is a booking (or the quote has been converted). */
  isBooked: boolean;
  /** When the booking was created. */
  bookedAt: string | null;
  /** First name used in "Waiting for {name}". */
  clientFirstName?: string | null;
  now?: Date;
}

export interface QuoteStage {
  steps: QuoteStep[];
  current: QuoteStageId;
  acceptedSource: AcceptedSource | null;
  canMarkAccepted: boolean;
  canUndo: boolean;
}

const ORDER: Array<{ id: QuoteStageId; label: string }> = [
  { id: "created", label: "Created" },
  { id: "sent", label: "Sent" },
  { id: "viewed", label: "Viewed" },
  { id: "accepted", label: "Accepted" },
  { id: "booked", label: "Booked" },
];

function firstWord(name: string | null | undefined): string {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}

function acceptedNote(input: QuoteStageInput, source: AcceptedSource | null): string {
  if (source === "customer" && input.customerAccepted) {
    const who = input.customerAccepted.name?.trim() || "the customer";
    return `By ${who} · ${formatDay(input.customerAccepted.at)}`;
  }
  if (source === "manual" && input.manualAccepted) {
    const who = firstWord(input.manualAccepted.byName) || "an agent";
    return `Marked by ${who} · ${formatDay(input.manualAccepted.at)}`;
  }
  if (input.isBooked) return "Done";
  const first = firstWord(input.clientFirstName);
  return first ? `Waiting for ${first}` : "Waiting for the customer";
}

export function deriveQuoteStage(input: QuoteStageInput): QuoteStage {
  const now = input.now ?? new Date();
  const acceptedSource: AcceptedSource | null = input.customerAccepted ? "customer" : input.manualAccepted ? "manual" : null;
  const viewed = input.viewCount > 0;

  const hasData: Record<QuoteStageId, boolean> = {
    created: true,
    sent: !!input.sentAt,
    viewed,
    accepted: acceptedSource !== null,
    booked: input.isBooked,
  };

  let currentIndex = 0;
  ORDER.forEach((s, i) => {
    if (hasData[s.id]) currentIndex = i;
  });

  const ago = viewed ? timeAgo(input.lastViewedAt, now) : "";
  const viewedNote = viewed
    ? `${input.viewCount} ${input.viewCount === 1 ? "time" : "times"}${ago ? `, last ${ago}` : ""}`
    : currentIndex > 2
      ? "Not recorded"
      : "Not yet";

  const notes: Record<QuoteStageId, string> = {
    created: formatDay(input.createdAt),
    sent: input.sentAt ? formatDay(input.sentAt) : currentIndex > 1 ? "Not recorded" : "Not yet",
    viewed: viewedNote,
    accepted: acceptedNote(input, acceptedSource),
    booked: input.isBooked ? formatDay(input.bookedAt) || "Booked" : "Not yet",
  };

  const steps: QuoteStep[] = ORDER.map((s, i) => ({
    id: s.id,
    label: s.label,
    note: notes[s.id],
    state: input.isBooked || i < currentIndex ? "done" : i === currentIndex ? "now" : "todo",
  }));

  return {
    steps,
    current: ORDER[currentIndex]!.id,
    acceptedSource,
    canMarkAccepted: !input.isBooked && acceptedSource === null,
    canUndo: !input.isBooked && acceptedSource === "manual",
  };
}

const VIA_LABEL: Record<string, string> = { link: "link", sms: "SMS", email: "email", whatsapp: "WhatsApp" };

/** "Sent 12 Oct 2026 by SMS", or null when the quote has not been sent. */
export function sentSummary(sentAt: string | null | undefined, sentVia: string | null | undefined): string | null {
  const day = formatDay(sentAt);
  if (!day) return null;
  const via = sentVia ? (VIA_LABEL[sentVia.toLowerCase()] ?? sentVia) : "";
  return via ? `Sent ${day} by ${via}` : `Sent ${day}`;
}
