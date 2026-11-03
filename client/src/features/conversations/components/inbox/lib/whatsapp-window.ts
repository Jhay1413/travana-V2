import type { WhatsappWindow } from "../../../api/whatsapp-updates.api";

/** How the reply box behaves for the open conversation. */
export type ComposerMode = "free" | "update" | "blocked" | "unknown";

export interface ComposerModeInput {
  isWhatsapp: boolean;
  /** Undefined while the window is loading or the fetch failed. */
  window: WhatsappWindow | undefined;
  /** Undefined while the template status is loading. */
  templateConfigured: boolean | undefined;
}

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * free: normal reply. unknown: WhatsApp window state not known, behave as normal.
 * update: window closed, send through the General update template.
 * blocked: window closed and no template is set.
 */
export function composerMode(input: ComposerModeInput): ComposerMode {
  if (!input.isWhatsapp) return "free";
  const w = input.window;
  if (!w || !w.known) return "unknown";
  const closed = w.requiresTemplate || !w.inWindow;
  if (!closed) return "free";
  if (input.templateConfigured === undefined) return "unknown";
  return input.templateConfigured ? "update" : "blocked";
}

export interface WindowHint {
  text: string;
  /** Amber when the window closes in under an hour. */
  tone: "normal" | "amber";
}

function remainingMs(w: WhatsappWindow, now: Date): number | null {
  if (!w.known) return null;
  if (w.windowEndAt) {
    const end = new Date(w.windowEndAt).getTime();
    if (Number.isFinite(end)) return end - now.getTime();
  }
  return w.remainingSeconds === null ? null : w.remainingSeconds * 1000;
}

function formatRemaining(ms: number): string {
  if (ms < MINUTE_MS) return "less than a minute";
  const totalMinutes = Math.floor(ms / MINUTE_MS);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

/** "Window open · closes in 3h 12m", or null when there is nothing worth showing. */
export function windowHint(w: WhatsappWindow | undefined, now: Date): WindowHint | null {
  if (!w || !w.known || !w.inWindow || w.requiresTemplate) return null;
  const ms = remainingMs(w, now);
  if (ms === null || ms <= 0) return null;
  return {
    text: `Window open · closes in ${formatRemaining(ms)}`,
    tone: ms < HOUR_MS ? "amber" : "normal",
  };
}

function formatAgo(ms: number): string {
  if (ms < MINUTE_MS) return "just now";
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"} ago`;
  if (ms < HOUR_MS) return unit(Math.floor(ms / MINUTE_MS), "minute");
  if (ms < DAY_MS) return unit(Math.floor(ms / HOUR_MS), "hour");
  return unit(Math.floor(ms / DAY_MS), "day");
}

/** "closed 3 hours ago" from the window end, or from 24h after the last customer message. */
export function windowClosedAgo(w: WhatsappWindow | undefined, now: Date): string | null {
  if (!w || !w.known) return null;
  let endMs = w.windowEndAt ? new Date(w.windowEndAt).getTime() : NaN;
  if (!Number.isFinite(endMs) && w.lastCustomerMessageAt) {
    endMs = new Date(w.lastCustomerMessageAt).getTime() + DAY_MS;
  }
  if (!Number.isFinite(endMs)) return null;
  return `closed ${formatAgo(Math.max(now.getTime() - endMs, 0))}`;
}

/** Amber note above the box in update mode. */
export function updateModeNote(w: WhatsappWindow | undefined, now: Date): string {
  const closed = windowClosedAgo(w, now);
  return `WhatsApp's 24-hour window ${closed ?? "has closed"}. Your message goes out in the agency's General update template. Line breaks become spaces.`;
}

export function blockedModeNote(firstName: string): string {
  return `WhatsApp's 24-hour window has closed. A manager needs to choose a General update template in Integrations before you can message ${firstName}.`;
}

export const UPDATE_MAX_CHARS = 700;
