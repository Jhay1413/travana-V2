import { describe, it, expect } from "vitest";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SendByChoice } from "./send-by-choice";
import type { SendAvailability, SendChannel } from "../types";

// The client build compiles JSX with the automatic runtime; vitest here uses the classic one, so React must be a global.
Object.assign(globalThis, { React });

const WA_REASON = "WhatsApp is not connected for your agency.";
const SMS_REASON = "This customer has opted out of text messages.";

function render(availability: SendAvailability | undefined, value: SendChannel = "whatsapp"): string {
  return renderToStaticMarkup(createElement(SendByChoice, { availability, value, onChange: () => undefined }));
}
const both: SendAvailability = { defaultChannel: "whatsapp", channels: { whatsapp: { available: true }, sms: { available: true } } };
// Class lists can contain ">" (e.g. has-[>svg]), so cut the tag out by position rather than with [^>]*.
const button = (html: string, channel: SendChannel): string => {
  const at = html.indexOf(`data-testid="send-by-${channel}"`);
  if (at < 0) return "";
  const start = html.lastIndexOf("<button", at);
  return html.slice(start, html.indexOf(">", at) + 1);
};

// Matches the attribute, not the "disabled:" Tailwind classes.
const isDisabled = (tag: string): boolean => /\sdisabled=""/.test(tag);

describe("SendByChoice", () => {
  it("shows both options with the pre-selected one pressed, and no helper text when both work", () => {
    const html = render(both, "sms");
    expect(button(html, "sms")).toContain('aria-checked="true"');
    expect(button(html, "whatsapp")).toContain('aria-checked="false"');
    expect(isDisabled(button(html, "whatsapp"))).toBe(false);
    expect(html).not.toContain("send-by-helper");
  });

  it("disables WhatsApp with its reason as hover text, a focusable wrapper and helper text; SMS stays enabled", () => {
    const html = render({ defaultChannel: "sms", channels: { whatsapp: { available: false, reason: WA_REASON }, sms: { available: true } } }, "sms");
    expect(isDisabled(button(html, "whatsapp"))).toBe(true);
    expect(isDisabled(button(html, "sms"))).toBe(false);
    expect(html).toContain(`title="${WA_REASON}"`);
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('data-testid="send-by-reason-whatsapp"');
    expect(html).not.toContain('data-testid="send-by-reason-sms"');
  });

  it("disables SMS with its reason, and shows both reasons when neither works", () => {
    const html = render({ defaultChannel: "whatsapp", channels: { whatsapp: { available: false, reason: WA_REASON }, sms: { available: false, reason: SMS_REASON } } });
    expect(isDisabled(button(html, "sms"))).toBe(true);
    expect(isDisabled(button(html, "whatsapp"))).toBe(true);
    expect(html).toContain("send-by-reason-whatsapp");
    expect(html).toContain("send-by-reason-sms");
    expect(html).toContain("opted out of text messages");
  });

  it("keeps both options disabled until availability is known (no guessing which channel works)", () => {
    const html = render(undefined);
    expect(isDisabled(button(html, "whatsapp"))).toBe(true);
    expect(isDisabled(button(html, "sms"))).toBe(true);
  });
});

describe("SendByChoice: an available option that opens WhatsApp on the device", () => {
  it("stays enabled and shows its note as helper text, with no 'unavailable' reason", () => {
    const html = render({ defaultChannel: "whatsapp", channels: { whatsapp: { available: true, note: "Opens WhatsApp on your device." }, sms: { available: true } } });
    expect(isDisabled(button(html, "whatsapp"))).toBe(false);
    expect(html).toContain('data-testid="send-by-note-whatsapp"');
    expect(html).toContain("Opens WhatsApp on your device.");
    expect(html).not.toContain("send-by-reason-");
  });
});
