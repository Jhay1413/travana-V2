import { describe, expect, it } from "vitest";
import type { WhatsappWindow } from "../../../api/whatsapp-updates.api";
import { blockedModeNote, composerMode, updateModeNote, windowClosedAgo, windowHint } from "./whatsapp-window";

const NOW = new Date("2026-10-29T12:00:00.000Z");
const iso = (ms: number) => new Date(NOW.getTime() + ms).toISOString();
const H = 3_600_000;
const M = 60_000;

function open(endInMs: number): WhatsappWindow {
  return {
    known: true,
    inWindow: true,
    requiresTemplate: false,
    remainingSeconds: Math.floor(endInMs / 1000),
    windowEndAt: iso(endInMs),
    lastCustomerMessageAt: iso(endInMs - 24 * H),
  };
}
const closed = (endedAgoMs: number): WhatsappWindow => ({
  known: true,
  inWindow: false,
  requiresTemplate: true,
  remainingSeconds: null,
  windowEndAt: iso(-endedAgoMs),
  lastCustomerMessageAt: iso(-endedAgoMs - 24 * H),
});

describe("composerMode", () => {
  it("is free for non-WhatsApp channels whatever the window says", () => {
    expect(composerMode({ isWhatsapp: false, window: closed(H), templateConfigured: false })).toBe("free");
  });
  it("is unknown when the window is missing or unknown", () => {
    expect(composerMode({ isWhatsapp: true, window: undefined, templateConfigured: true })).toBe("unknown");
    expect(composerMode({ isWhatsapp: true, window: { known: false }, templateConfigured: false })).toBe("unknown");
  });
  it("is free with an open window", () => {
    expect(composerMode({ isWhatsapp: true, window: open(5 * H), templateConfigured: false })).toBe("free");
  });
  it("is update when closed and a template exists", () => {
    expect(composerMode({ isWhatsapp: true, window: closed(H), templateConfigured: true })).toBe("update");
  });
  it("is blocked when closed and no template exists", () => {
    expect(composerMode({ isWhatsapp: true, window: closed(H), templateConfigured: false })).toBe("blocked");
  });
  it("treats inWindow false alone as closed", () => {
    const w: WhatsappWindow = { ...closed(H), requiresTemplate: false } as WhatsappWindow;
    expect(composerMode({ isWhatsapp: true, window: w, templateConfigured: true })).toBe("update");
  });
  it("stays unknown while the template status loads for a closed window", () => {
    expect(composerMode({ isWhatsapp: true, window: closed(H), templateConfigured: undefined })).toBe("unknown");
  });
});

describe("windowHint", () => {
  it("shows hours and minutes in the normal tone", () => {
    expect(windowHint(open(3 * H + 12 * M), NOW)).toEqual({ text: "Window open · closes in 3h 12m", tone: "normal" });
  });
  it("goes amber under an hour", () => {
    expect(windowHint(open(42 * M), NOW)).toEqual({ text: "Window open · closes in 42m", tone: "amber" });
  });
  it("is not amber at exactly one hour", () => {
    expect(windowHint(open(H), NOW)?.tone).toBe("normal");
  });
  it("says less than a minute near the end", () => {
    expect(windowHint(open(20_000), NOW)).toEqual({ text: "Window open · closes in less than a minute", tone: "amber" });
  });
  it("falls back to remainingSeconds without windowEndAt", () => {
    const w = { ...open(2 * H), windowEndAt: null } as WhatsappWindow;
    expect(windowHint(w, NOW)?.text).toBe("Window open · closes in 2h 0m");
  });
  it("is null when closed, unknown, missing or already expired", () => {
    expect(windowHint(closed(H), NOW)).toBeNull();
    expect(windowHint({ known: false }, NOW)).toBeNull();
    expect(windowHint(undefined, NOW)).toBeNull();
    expect(windowHint(open(-M), NOW)).toBeNull();
  });
});

describe("windowClosedAgo", () => {
  it("describes minutes, hours and days", () => {
    expect(windowClosedAgo(closed(5 * M), NOW)).toBe("closed 5 minutes ago");
    expect(windowClosedAgo(closed(3 * H), NOW)).toBe("closed 3 hours ago");
    expect(windowClosedAgo(closed(H), NOW)).toBe("closed 1 hour ago");
    expect(windowClosedAgo(closed(50 * H), NOW)).toBe("closed 2 days ago");
    expect(windowClosedAgo(closed(10_000), NOW)).toBe("closed just now");
  });
  it("derives the end from the last customer message", () => {
    const w = { ...closed(2 * H), windowEndAt: null } as WhatsappWindow;
    expect(windowClosedAgo(w, NOW)).toBe("closed 2 hours ago");
  });
  it("is null with no dates or an unknown window", () => {
    expect(windowClosedAgo({ ...closed(H), windowEndAt: null, lastCustomerMessageAt: null } as WhatsappWindow, NOW)).toBeNull();
    expect(windowClosedAgo({ known: false }, NOW)).toBeNull();
  });
});

describe("notes", () => {
  it("builds the update-mode note", () => {
    expect(updateModeNote(closed(3 * H), NOW)).toBe(
      "WhatsApp's 24-hour window closed 3 hours ago. Your message goes out in the agency's General update template. Line breaks become spaces.",
    );
    expect(updateModeNote(undefined, NOW)).toContain("window has closed.");
  });
  it("builds the blocked note", () => {
    expect(blockedModeNote("Sam")).toBe(
      "WhatsApp's 24-hour window has closed. A manager needs to choose a General update template in Integrations before you can message Sam.",
    );
  });
});
