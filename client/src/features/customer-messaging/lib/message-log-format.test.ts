import { describe, it, expect } from "vitest";
import { formatLogRow, formatLogTime, purposeLabel, statusText } from "./message-log-format";
import type { MessageLogEntry } from "../types";

const entry = (over: Partial<MessageLogEntry> = {}): MessageLogEntry => ({
  id: "r1",
  purpose: "booking_confirmation",
  channel: "whatsapp",
  status: "sent",
  reason: null,
  templateName: null,
  triggerSource: null,
  triggeredByName: null,
  createdAt: "2030-11-24T14:02:00.000Z",
  ...over,
});

describe("formatLogRow", () => {
  it("reads 'Booking confirmation · WhatsApp · Sent · 24 Nov 14:02' (UK time, winter)", () => {
    expect(formatLogRow(entry()).line).toBe("Booking confirmation · WhatsApp · Sent · 24 Nov 14:02");
  });
  it("reads 'Balance reminder · SMS · Not sent — customer opted out'", () => {
    const row = formatLogRow(entry({ purpose: "balance_reminder", channel: "sms", status: "skipped", reason: "customer opted out" }));
    expect(row.line).toBe("Balance reminder · SMS · Not sent — customer opted out · 24 Nov 14:02");
    expect(row.sent).toBe(false);
  });
  it("shows the time in UK summer time", () => {
    expect(formatLogTime("2030-07-01T13:05:00.000Z")).toBe("1 Jul 14:05");
  });
  it("adds who sent it and the template as a small second line", () => {
    expect(formatLogRow(entry({ triggeredByName: "Ann Agent", templateName: "quote_tpl" })).detail).toBe("by Ann Agent · template quote_tpl");
    expect(formatLogRow(entry()).detail).toBeNull();
  });
  it("names the staff-sent types", () => {
    expect(purposeLabel("quote_link")).toBe("Quote link");
    expect(purposeLabel("portal_sign_in")).toBe("Portal sign-in link");
  });
  it("makes an unknown type and channel readable instead of showing a code", () => {
    expect(purposeLabel("some_new_thing")).toBe("Some new thing");
    expect(formatLogRow(entry({ channel: "carrier_pigeon" })).line).toContain("Unknown channel");
  });
  it("shows a message still being sent as 'Sending', and a skip with no reason as plain 'Not sent'", () => {
    expect(statusText({ status: "pending", reason: null })).toBe("Sending");
    expect(statusText({ status: "skipped", reason: null })).toBe("Not sent");
  });
  it("exposes only the line, the detail and the sent flag", () => {
    expect(Object.keys(formatLogRow(entry({ triggerSource: "staff" }))).sort()).toEqual(["detail", "line", "sent"]);
  });
});
