import { NO_DECISION, PORTAL_DECLINE_REASONS, type PortalQuoteDecision, type PortalQuoteDetail, type PortalQuoteListItem } from "@shared/portal-quotes";

/** The list split into quotes still being considered and those the customer said are not for them. */
export function splitQuotes(quotes: PortalQuoteListItem[]): { active: PortalQuoteListItem[]; declined: PortalQuoteListItem[] } {
  const active: PortalQuoteListItem[] = [];
  const declined: PortalQuoteListItem[] = [];
  for (const q of quotes) (q.decision.state === "declined" ? declined : active).push(q);
  return { active, declined };
}

/** The list with one quote's decision replaced (all other quotes untouched). */
export function applyDecisionToList(quotes: PortalQuoteListItem[], id: string, decision: PortalQuoteDecision): PortalQuoteListItem[] {
  return quotes.map((q) => (q.id === id ? { ...q, decision } : q));
}

export function applyDecisionToDetail(quote: PortalQuoteDetail, decision: PortalQuoteDecision): PortalQuoteDetail {
  return { ...quote, decision };
}

/** The decision a quote shows straight after the customer taps (before the server answers). */
export function optimisticDecision(action: "interested" | "declined" | "reopened", input: { note?: string; reason?: string | null; wantsSimilar?: boolean } = {}): PortalQuoteDecision {
  const at = new Date().toISOString();
  if (action === "reopened") return { ...NO_DECISION };
  if (action === "interested") return { state: "interested", reason: null, note: input.note?.trim() || null, wantsSimilar: null, at };
  return { state: "declined", reason: input.reason || null, note: input.note?.trim() || null, wantsSimilar: input.wantsSimilar ?? true, at };
}

/** Selector: the decision buttons and the interested block show only while the customer can still decide. */
export function canShowDecisionControls(quote: Pick<PortalQuoteDetail, "canDecide" | "decision">): boolean {
  return quote.canDecide && quote.decision.state === "none";
}

/** The plain sentence for a declined quote ("You told Sam this one isn't for you: too expensive."). */
export function declinedSentence(decision: PortalQuoteDecision, agent: string): string {
  const reason = decision.reason ? `: ${decision.reason.toLowerCase()}` : "";
  const similar = decision.wantsSimilar ? ` ${agent} will look for something similar.` : "";
  return `You told ${agent} this one isn't for you${reason}.${similar}`;
}

/* ── The "Not interested" sheet's form ── */

export interface DeclineForm {
  reason: string;
  note: string;
  wantsSimilar: boolean;
}

export type DeclineFormEvent =
  | { type: "reason"; reason: string }
  | { type: "note"; note: string }
  | { type: "similar"; value: boolean }
  | { type: "reset" };

export const INITIAL_DECLINE_FORM: DeclineForm = { reason: "", note: "", wantsSimilar: true };

/** Choosing the chosen reason again clears it; "send me something similar" starts ticked. */
export function declineFormReducer(state: DeclineForm, event: DeclineFormEvent): DeclineForm {
  switch (event.type) {
    case "reason":
      if (!(PORTAL_DECLINE_REASONS as readonly string[]).includes(event.reason)) return state;
      return { ...state, reason: state.reason === event.reason ? "" : event.reason };
    case "note":
      return { ...state, note: event.note };
    case "similar":
      return { ...state, wantsSimilar: event.value };
    case "reset":
      return INITIAL_DECLINE_FORM;
  }
}
