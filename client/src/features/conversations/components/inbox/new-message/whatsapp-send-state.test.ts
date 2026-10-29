import { describe, expect, it } from "vitest";
import { whatsappSendBlocked, whatsappSendState, type WhatsappSendStateInput } from "./whatsapp-send-state";

const base: WhatsappSendStateInput = {
  channelType: "whatsapp",
  linkLoaded: true,
  hasContact: false,
  phone: "07700 900123",
  templateConfigured: true,
  firstName: "Sam",
};

describe("whatsappSendState", () => {
  it("is quiet until the link lookup finishes or when a contact exists", () => {
    expect(whatsappSendState({ ...base, linkLoaded: false })).toEqual({ kind: "none" });
    expect(whatsappSendState({ ...base, hasContact: true })).toEqual({ kind: "none" });
  });
  it("explains the template send for an unlinked client with a phone", () => {
    expect(whatsappSendState(base)).toEqual({
      kind: "info",
      message: "Sam hasn't messaged you on WhatsApp yet, so this goes out as your General update template to 07700 900123.",
    });
  });
  it("errors without a phone", () => {
    expect(whatsappSendState({ ...base, phone: "  " }).kind).toBe("error");
  });
  it("errors without a template", () => {
    const s = whatsappSendState({ ...base, templateConfigured: false });
    expect(s.kind).toBe("error");
    expect(s.kind === "error" && s.message).toContain("A manager needs to choose one in Integrations");
  });
  it("keeps the old dead end for email and SMS", () => {
    expect(whatsappSendState({ ...base, channelType: "email" })).toMatchObject({ kind: "error" });
    expect(whatsappSendState({ ...base, channelType: "sms", templateConfigured: true })).toMatchObject({
      kind: "error",
      message: "This client has no messaging contact yet. Link or message them from a channel first.",
    });
  });
});

describe("whatsappSendBlocked", () => {
  it("blocks on errors and while the template status loads", () => {
    expect(whatsappSendBlocked({ kind: "error", message: "x" }, base)).toBe(true);
    const loading = { ...base, templateConfigured: undefined };
    expect(whatsappSendBlocked(whatsappSendState(loading), loading)).toBe(true);
    expect(whatsappSendBlocked(whatsappSendState(base), base)).toBe(false);
  });
});
