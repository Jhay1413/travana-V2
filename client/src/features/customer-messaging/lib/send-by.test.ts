import { describe, it, expect } from "vitest";
import { canSendBy, effectiveChannel, initialChannel, toastForResult } from "./send-by";
import type { SendAvailability } from "../types";

const av = (over: Partial<SendAvailability> & { whatsapp?: boolean; sms?: boolean } = {}): SendAvailability => ({
  defaultChannel: over.defaultChannel ?? "whatsapp",
  channels: {
    whatsapp: over.whatsapp === false ? { available: false, reason: "WhatsApp is not connected for your agency." } : { available: true },
    sms: over.sms === false ? { available: false, reason: "This customer has opted out of text messages." } : { available: true },
  },
});

describe("initialChannel: pre-selection from the agency setting", () => {
  it("starts on the agency channel", () => {
    expect(initialChannel(av({ defaultChannel: "whatsapp" }))).toBe("whatsapp");
    expect(initialChannel(av({ defaultChannel: "sms" }))).toBe("sms");
  });
  it("starts on WhatsApp while availability is still loading", () => {
    expect(initialChannel(undefined)).toBe("whatsapp");
  });
  it("moves to the other channel only when the agency channel cannot be used and the other can", () => {
    expect(initialChannel(av({ defaultChannel: "whatsapp", whatsapp: false }))).toBe("sms");
    expect(initialChannel(av({ defaultChannel: "sms", sms: false }))).toBe("whatsapp");
  });
  it("keeps the agency channel (shown disabled) when neither can be used", () => {
    expect(initialChannel(av({ defaultChannel: "sms", sms: false, whatsapp: false }))).toBe("sms");
  });
});

describe("effectiveChannel: the staff member's pick wins while it is usable", () => {
  it("uses the pick", () => {
    expect(effectiveChannel("sms", av({ defaultChannel: "whatsapp" }))).toBe("sms");
  });
  it("ignores a pick that has become unavailable", () => {
    expect(effectiveChannel("sms", av({ sms: false }))).toBe("whatsapp");
  });
  it("uses the starting channel when nothing was picked", () => {
    expect(effectiveChannel(null, av({ defaultChannel: "sms" }))).toBe("sms");
  });
});

describe("canSendBy", () => {
  it("is false until availability is known, and false for an unavailable channel", () => {
    expect(canSendBy("whatsapp", undefined)).toBe(false);
    expect(canSendBy("whatsapp", av({ whatsapp: false }))).toBe(false);
    expect(canSendBy("sms", av({ whatsapp: false }))).toBe(true);
  });
});

describe("toastForResult", () => {
  it("says which channel a quote went by, and mentions the template when one was used", () => {
    expect(toastForResult({ status: "sent", channel: "sms" }, "quote")?.title).toBe("Quote link sent by SMS");
    expect(toastForResult({ status: "sent", channel: "whatsapp" }, "quote")?.title).toBe("Quote link sent via WhatsApp");
    expect(toastForResult({ status: "sent", channel: "whatsapp", viaTemplate: true }, "quote")?.title).toBe("Sent to the client as a WhatsApp template message");
  });
  it("says which channel a sign-in link went by", () => {
    expect(toastForResult({ status: "sent", channel: "sms" }, "sign-in link")?.title).toBe("Sign-in link sent by SMS");
    expect(toastForResult({ status: "sent", channel: "whatsapp" }, "sign-in link")?.title).toBe("Sign-in link sent via WhatsApp");
  });
  it("shows a not-sent result as a plain reason", () => {
    expect(toastForResult({ status: "not_sent", channel: "sms", reason: "opted_out", message: "Customer opted out." }, "quote")).toEqual({
      title: "Not sent",
      description: "Customer opted out.",
      variant: "destructive",
    });
  });
  it("shows nothing for the wa.me fallback (the dialog has its own panel)", () => {
    expect(toastForResult({ status: "fallback", channel: "whatsapp", fallback: { reason: "window_closed", text: "t", quoteUrl: "u" } }, "quote")).toBeNull();
  });
});
