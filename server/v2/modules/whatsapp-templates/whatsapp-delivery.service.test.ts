import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../user/user.repository", () => ({ userRepository: { findById: vi.fn() } }));
vi.mock("../organization/organization.repository", () => ({ organizationRepository: { findById: vi.fn() } }));
vi.mock("../contact-link/contact-link.service", () => ({ contactLinkService: { linkIfUnlinked: vi.fn() } }));
vi.mock("../conversations/conversations.service", () => ({ conversationsService: { getById: vi.fn() } }));
vi.mock("./whatsapp-templates.repository", () => ({ whatsappTemplatesRepository: { send: vi.fn() } }));
vi.mock("../sms/sms.service", () => ({
  normalisePhone: vi.fn((raw: string | null | undefined) => {
    const digits = raw ? String(raw).replace(/\D/g, "") : "";
    return digits ? "+" + digits.replace(/^0/, "44") : null;
  }),
}));

import {
  isWindowClosed,
  isWindowMessage,
  isWindowRejection,
  linkClientToConversationContact,
  pickWhatsappChannel,
  resolveVariableValues,
  sanitizeTemplateParam,
  sendTemplate,
  templateRecipient,
} from "./whatsapp-delivery.service";
import { userRepository } from "../user/user.repository";
import { organizationRepository } from "../organization/organization.repository";
import { contactLinkService } from "../contact-link/contact-link.service";
import { conversationsService } from "../conversations/conversations.service";
import { whatsappTemplatesRepository } from "./whatsapp-templates.repository";
import { AppError } from "../../utils/error-handler";
import type { SsChannel } from "../channels/channels.types";
import type { Scope } from "../../utils/scope";

beforeEach(() => vi.resetAllMocks());

describe("isWindowClosed", () => {
  it("is false for nothing, or an unknown (null/empty) window_status", () => {
    expect(isWindowClosed(null)).toBe(false);
    expect(isWindowClosed(undefined)).toBe(false);
    expect(isWindowClosed({})).toBe(false);
    expect(isWindowClosed({ window_status: null })).toBe(false);
    expect(isWindowClosed({ window_status: {} })).toBe(false);
  });

  it("is true when requires_template is set at the top level", () => {
    expect(isWindowClosed({ requires_template: true })).toBe(true);
  });

  it("is true when window_status.in_window is false", () => {
    expect(isWindowClosed({ window_status: { in_window: false } })).toBe(true);
  });

  it("is true when window_status.requires_template is set", () => {
    expect(isWindowClosed({ window_status: { requires_template: true } })).toBe(true);
  });

  it("is false for an open window", () => {
    expect(isWindowClosed({ requires_template: false, window_status: { in_window: true, requires_template: false } })).toBe(false);
  });

  it("no longer reads the old guessed keys", () => {
    expect(isWindowClosed({ window_status: { is_open: false, window_closed: true, expired: true } as never })).toBe(false);
  });
});

describe("isWindowMessage / isWindowRejection", () => {
  it("matches window phrasing but not a bare template mention", () => {
    expect(isWindowMessage("Outside the 24-hour window")).toBe(true);
    expect(isWindowMessage("A template message is required")).toBe(true);
    expect(isWindowMessage("Invalid template parameter")).toBe(false);
  });

  it("treats only 4xx AppErrors about the window as rejections", () => {
    expect(isWindowRejection(new AppError("Outside the 24-hour window", 400))).toBe(true);
    expect(isWindowRejection(new AppError("Outside the 24-hour window", 502))).toBe(false);
    expect(isWindowRejection(new AppError("Invalid token", 401))).toBe(false);
    expect(isWindowRejection(new Error("Outside the 24-hour window"))).toBe(false);
  });
});

describe("pickWhatsappChannel", () => {
  const ch = (id: string, over: Partial<SsChannel> = {}) => ({ id, channel_type: "whatsapp", is_active: true, is_verified: true, ...over }) as SsChannel;

  it("prefers the saved channel when eligible", () => {
    expect(pickWhatsappChannel([ch("a"), ch("b")], "b")?.id).toBe("b");
  });

  it("falls back to the first eligible when the saved one is missing or ineligible", () => {
    expect(pickWhatsappChannel([ch("a", { is_active: false }), ch("b")], "a")?.id).toBe("b");
    expect(pickWhatsappChannel([ch("a"), ch("b")], "gone")?.id).toBe("a");
    expect(pickWhatsappChannel([ch("a"), ch("b")], null)?.id).toBe("a");
  });

  it("skips non-WhatsApp, inactive and unverified channels", () => {
    expect(pickWhatsappChannel([ch("a", { channel_type: "sms" }), ch("b", { is_verified: false })], null)).toBeUndefined();
  });
});

describe("templateRecipient", () => {
  it("an open conversation is the whole recipient", () => {
    expect(templateRecipient({ conversationId: "cv", contactId: "k", phone: "07700 900123" })).toEqual({ conversation_id: "cv" });
  });

  it("a linked contact without a conversation adds the phone as whatsapp_id", () => {
    expect(templateRecipient({ conversationId: null, contactId: "k", phone: "07700 900123" })).toEqual({
      contact_id: "k", conversation_id: null, whatsapp_id: "447700900123",
    });
  });

  it("a linked contact with no usable phone sends to the contact alone", () => {
    const r = templateRecipient({ conversationId: null, contactId: "k", phone: "" });
    expect(r).toEqual({ contact_id: "k", conversation_id: null });
    expect(r).not.toHaveProperty("whatsapp_id");
  });

  it("an unlinked client goes by phone number alone", () => {
    expect(templateRecipient({ conversationId: null, contactId: null, phone: "07700 900123" })).toEqual({ whatsapp_id: "447700900123" });
    expect(templateRecipient({ conversationId: null, contactId: null, phone: null })).toEqual({});
  });
});

describe("sanitizeTemplateParam", () => {
  it("turns newlines and tabs into single spaces", () => {
    expect(sanitizeTemplateParam("a\r\nb\nc\td")).toBe("a b c d");
    expect(sanitizeTemplateParam("a\n\n\nb")).toBe("a b");
  });

  it("collapses 4 or more spaces to one, keeps shorter runs, and trims", () => {
    expect(sanitizeTemplateParam("a     b")).toBe("a b");
    expect(sanitizeTemplateParam("a   b")).toBe("a   b");
    expect(sanitizeTemplateParam("  hi \n")).toBe("hi");
  });
});

describe("resolveVariableValues", () => {
  const ctx = { orgId: "o1", userId: "u1", clientFirstName: "Ann", quoteUrl: "https://x/q", message: "Your transfer\nis at 10:30." };

  beforeEach(() => {
    vi.mocked(userRepository.findById).mockResolvedValue({ name: "Sam Agent", email: "sam@x.com" } as never);
    vi.mocked(organizationRepository.findById).mockResolvedValue({ name: "Tina's Travel" } as never);
  });

  it("resolves every source, sanitizing the message", async () => {
    const values = await resolveVariableValues(
      {
        "1": { source: "client_first_name" }, "2": { source: "agent_name" }, "3": { source: "agency_name" },
        "4": { source: "quote_link" }, "5": { source: "message" }, "6": { source: "custom", text: "Thanks!" },
      },
      ctx,
    );
    expect(values).toEqual({
      "1": "Ann", "2": "Sam Agent", "3": "Tina's Travel", "4": "https://x/q", "5": "Your transfer is at 10:30.", "6": "Thanks!",
    });
  });

  it("falls back to non-empty values", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ name: null, email: "pat@x.com" } as never);
    vi.mocked(organizationRepository.findById).mockResolvedValue(null);
    const values = await resolveVariableValues(
      { "1": { source: "client_first_name" }, "2": { source: "agent_name" }, "3": { source: "agency_name" }, "4": { source: "message" }, "5": { source: "custom" } },
      { ...ctx, clientFirstName: "  ", message: " \n " },
    );
    expect(values).toEqual({ "1": "there", "2": "pat", "3": "our team", "4": "-", "5": "-" });

    vi.mocked(userRepository.findById).mockResolvedValue(undefined);
    expect((await resolveVariableValues({ "1": { source: "agent_name" } }, ctx))["1"]).toBe("your travel agent");
  });

  it("loads the user and org once, and only when needed", async () => {
    await resolveVariableValues({ "1": { source: "agent_name" }, "2": { source: "agent_name" }, "3": { source: "agency_name" } }, ctx);
    expect(userRepository.findById).toHaveBeenCalledTimes(1);
    expect(organizationRepository.findById).toHaveBeenCalledTimes(1);
    vi.resetAllMocks();
    await resolveVariableValues({ "1": { source: "message" } }, ctx);
    expect(userRepository.findById).not.toHaveBeenCalled();
    expect(organizationRepository.findById).not.toHaveBeenCalled();
  });

  it("throws a 500 when quote_link or message has no value in the context", async () => {
    await expect(resolveVariableValues({ "1": { source: "quote_link" } }, { ...ctx, quoteUrl: undefined })).rejects.toMatchObject({ statusCode: 500 });
    await expect(resolveVariableValues({ "1": { source: "message" } }, { ...ctx, message: undefined })).rejects.toMatchObject({ statusCode: 500 });
  });
});

describe("sendTemplate", () => {
  it("builds the SendSeven body from the recipient, channel, language and values", async () => {
    const res = { success: true, conversation_id: "cv" };
    vi.mocked(whatsappTemplatesRepository.send).mockResolvedValue(res as never);
    await expect(
      sendTemplate({ templateName: "t", language: "en", channelId: "ch1", recipient: { conversation_id: "cv" }, variableValues: { "1": "a" } }),
    ).resolves.toBe(res);
    expect(whatsappTemplatesRepository.send).toHaveBeenCalledWith("t", {
      conversation_id: "cv", channel_id: "ch1", language: "en", variable_values: { "1": "a" },
    });
  });

  it("omits a null language and lets errors through to the caller", async () => {
    vi.mocked(whatsappTemplatesRepository.send).mockRejectedValue(new AppError("down", 502));
    await expect(
      sendTemplate({ templateName: "t", language: null, channelId: "ch1", recipient: {}, variableValues: {} }),
    ).rejects.toMatchObject({ statusCode: 502 });
    expect(vi.mocked(whatsappTemplatesRepository.send).mock.calls[0][1].language).toBeUndefined();
  });
});

describe("linkClientToConversationContact", () => {
  const scope = { orgId: "o1", userId: "u1" } as Scope;

  it("links the client to the conversation's contact", async () => {
    vi.mocked(conversationsService.getById).mockResolvedValue({ id: "cv", contact_id: "k9" } as never);
    await linkClientToConversationContact("cv", "c1", scope);
    expect(conversationsService.getById).toHaveBeenCalledWith("o1", "cv");
    expect(contactLinkService.linkIfUnlinked).toHaveBeenCalledWith("k9", "c1", scope);
  });

  it("leaves a contact already linked to another client alone and logs", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.mocked(conversationsService.getById).mockResolvedValue({ id: "cv", contact_id: "k9" } as never);
    vi.mocked(contactLinkService.linkIfUnlinked).mockResolvedValue("linked_to_other");
    await linkClientToConversationContact("cv", "c1", scope);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("already linked to another client"));
    warn.mockRestore();
  });

  it("is a quiet no-op when the contact is already linked to the same client", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.mocked(conversationsService.getById).mockResolvedValue({ id: "cv", contact_id: "k9" } as never);
    vi.mocked(contactLinkService.linkIfUnlinked).mockResolvedValue("already_linked");
    await linkClientToConversationContact("cv", "c1", scope);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("does nothing without a conversation or contact, and swallows failures", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await linkClientToConversationContact(null, "c1", scope);
    vi.mocked(conversationsService.getById).mockResolvedValue({ id: "cv", contact_id: null } as never);
    await linkClientToConversationContact("cv", "c1", scope);
    expect(contactLinkService.linkIfUnlinked).not.toHaveBeenCalled();

    vi.mocked(conversationsService.getById).mockResolvedValue({ id: "cv", contact_id: "k9" } as never);
    vi.mocked(contactLinkService.linkIfUnlinked).mockRejectedValue(new Error("nope"));
    await expect(linkClientToConversationContact("cv", "c1", scope)).resolves.toBeUndefined();
    warn.mockRestore();
  });
});
