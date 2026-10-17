import type { ErrorKey, FormErrors } from "./enquiry-form";

// Short labels for the "Still needed" callout, and the phrase each one takes
// inside the drafted question to the client.
const MISSING: { key: ErrorKey; label: string; phrase: string }[] = [
  { key: "destinations", label: "destination", phrase: "where you'd like to go" },
  { key: "airports", label: "departure airport", phrase: "which airport you'd like to fly from" },
  { key: "travelDate", label: "travel date", phrase: "when you'd like to travel" },
  { key: "travellers", label: "who is travelling", phrase: "who is travelling" },
];

/** Required details the client (not the agent) has to supply, as short labels. */
export function missingForClient(errors: FormErrors): string[] {
  return MISSING.filter((m) => errors[m.key]).map((m) => m.label);
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Drafted question for the reply box. `missing` takes the short labels. */
export function askText(first: string, missing: string[]): string {
  const phrases = missing.map((label) => MISSING.find((m) => m.label === label)?.phrase ?? label);
  return `Hi ${first}, so I can put the options together, could you tell me ${joinList(phrases)}? Thanks`;
}

export interface TimedMessage {
  direction: string;
  text?: string | null;
  created_at: string;
}

/** The newest inbound text message, regardless of list order. */
export function lastInbound(messages: TimedMessage[]): { text: string; at: string } | null {
  let best: { text: string; at: string } | null = null;
  for (const m of messages) {
    const text = m.text?.trim();
    if (m.direction !== "inbound" || !text) continue;
    if (!best || Date.parse(m.created_at) >= Date.parse(best.at)) best = { text, at: m.created_at };
  }
  return best;
}
