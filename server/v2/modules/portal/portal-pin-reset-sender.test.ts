import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../conversation-integration/conversation-integration.service", () => ({
  conversationIntegrationService: { resolveConfig: vi.fn() },
}));
vi.mock("../channels/channels.service", () => ({ channelsService: { listChannels: vi.fn() } }));
vi.mock("../contact-link/contact-link.repository", () => ({ contactLinkRepository: { findByClient: vi.fn() } }));
vi.mock("../conversations/conversations.service", () => ({ conversationsService: { checkExisting: vi.fn(), getById: vi.fn(), openOrCreate: vi.fn() } }));
vi.mock("../messages/messages.repository", () => ({ messagesRepository: { send: vi.fn() } }));
vi.mock("../usage/usage.service", () => ({ usageService: { recordSendsevenSend: vi.fn() } }));
vi.mock("../messages/messages.service", () => ({ messagesService: { afterStaffSend: vi.fn() } }));
vi.mock("../whatsapp-templates/whatsapp-settings.service", () => ({ whatsappSettingsService: { getPinReset: vi.fn() } }));
// Real window/recipient/variable rules; only the SendSeven template call itself and the lookups it makes are replaced.
vi.mock("../whatsapp-templates/whatsapp-templates.repository", () => ({ whatsappTemplatesRepository: { send: vi.fn() } }));
vi.mock("../organization/organization.repository", () => ({ organizationRepository: { findById: vi.fn() } }));
vi.mock("../user/user.repository", () => ({ userRepository: { findById: vi.fn() } }));
vi.mock("../contact-link/contact-link.service", () => ({ contactLinkService: {} }));
vi.mock("../sms/sms.service", () => ({
  normalisePhone: (raw: string | null | undefined) => {
    if (!raw) return null;
    const p = raw.replace(/[^\d+]/g, "");
    if (p.startsWith("+")) return p;
    if (p.startsWith("0")) return `+44${p.slice(1)}`;
    if (p.startsWith("44")) return `+${p}`;
    return `+44${p}`;
  },
  sendSms: vi.fn(),
  consumeSmsCredit: vi.fn(),
}));

import { sendPinResetWhatsapp, type PinResetWhatsappInput } from "./portal-pin-reset-sender";
import { conversationIntegrationService } from "../conversation-integration/conversation-integration.service";
import { channelsService } from "../channels/channels.service";
import { contactLinkRepository } from "../contact-link/contact-link.repository";
import { conversationsService } from "../conversations/conversations.service";
import { messagesRepository } from "../messages/messages.repository";
import { whatsappSettingsService } from "../whatsapp-templates/whatsapp-settings.service";
import { whatsappTemplatesRepository } from "../whatsapp-templates/whatsapp-templates.repository";
import { organizationRepository } from "../organization/organization.repository";
import { sendSms } from "../sms/sms.service";
import { messagesService } from "../messages/messages.service";
import { usageService } from "../usage/usage.service";
import { AppError } from "../../utils/error-handler";

const cfg = vi.mocked(conversationIntegrationService.resolveConfig);
const channels = vi.mocked(channelsService.listChannels);
const link = vi.mocked(contactLinkRepository.findByClient);
const conv = vi.mocked(conversationsService);
const text = vi.mocked(messagesRepository.send);
const settings = vi.mocked(whatsappSettingsService.getPinReset);
const tpl = vi.mocked(whatsappTemplatesRepository.send);
const org = vi.mocked(organizationRepository.findById);

const channel = { id: "ch1", channel_type: "whatsapp", is_active: true, is_verified: true };
const LINK = "https://portal.example/portal/login?mt=CODE&next=x";
const TEMPLATE = {
  templateName: "portal_sign_in",
  templateLanguage: "en_GB",
  channelId: null,
  variables: {
    "1": { source: "client_first_name" as const },
    "2": { source: "agency_name" as const },
    "3": { source: "sign_in_link" as const },
    "4": { source: "custom" as const, text: "  " },
  },
};
const NO_TEMPLATE = { templateName: null, templateLanguage: null, channelId: null, variables: {} };
const OWN_PHONE = "+447700900123";

function input(over: Partial<PinResetWhatsappInput> = {}) {
  const reserve = vi.fn().mockResolvedValue(LINK);
  return { orgId: "o1", clientId: "c1", firstName: "Sam", orgName: "Sunny Travel", phone: OWN_PHONE, reserve, ...over } as PinResetWhatsappInput & { reserve: ReturnType<typeof vi.fn> };
}

/** An open chat with a linked contact whose WhatsApp number is `phone`. */
function openChat(window: Record<string, unknown>, phone: string | null = "07700 900123") {
  conv.checkExisting.mockResolvedValue({ has_existing_open: true, existing_open_conversation_id: "cv1", ...window } as never);
  conv.getById.mockResolvedValue({ id: "cv1", contact: phone ? { phone } : null } as never);
}

beforeEach(() => {
  vi.resetAllMocks();
  cfg.mockResolvedValue({ baseUrl: "https://ss.example", token: "t" });
  channels.mockResolvedValue([channel] as never);
  settings.mockResolvedValue(TEMPLATE);
  link.mockResolvedValue({ sendsevenContactId: "ct1" } as never);
  org.mockResolvedValue({ name: "Sunny Travel" } as never);
  tpl.mockResolvedValue({ success: true, message_id: "m", external_id: null, conversation_id: "cv9", error: null, error_code: null, error_details: null });
  text.mockResolvedValue({ id: "m1", conversation_id: "cv1", status: "sent" } as never);
});

describe("window open, the customer's own chat: plain text", () => {
  beforeEach(() => openChat({ window_status: { in_window: true } }));

  it("sends the sign-in link as a text in the open conversation, reserving the link first", async () => {
    const i = input();
    expect(await sendPinResetWhatsapp(i)).toEqual({ status: "sent", viaTemplate: false });
    expect(text).toHaveBeenCalledTimes(1);
    expect(text.mock.calls[0][0]).toMatchObject({ conversation_id: "cv1", channel_id: "ch1", message_type: "text" });
    expect(String(text.mock.calls[0][0].text)).toContain(LINK);
    expect(tpl).not.toHaveBeenCalled();
    expect(i.reserve).toHaveBeenCalledTimes(1);
  });

  it("needs no template to be set for a text", async () => {
    settings.mockResolvedValue(NO_TEMPLATE);
    expect((await sendPinResetWhatsapp(input())).status).toBe("sent");
  });

  it("a rejection about the 24h window falls back to the template, in that same chat, with the same link", async () => {
    text.mockRejectedValue(new AppError("Outside the 24 hour messaging window", 400));
    const i = input();
    expect(await sendPinResetWhatsapp(i)).toEqual({ status: "sent", viaTemplate: true });
    expect(tpl).toHaveBeenCalledTimes(1);
    expect(tpl.mock.calls[0][1]).toMatchObject({ conversation_id: "cv1" });
    expect(i.reserve).toHaveBeenCalledTimes(1);
  });

  it("a failed message that names the window falls back to the template", async () => {
    text.mockResolvedValue({ id: "m", conversation_id: "cv1", status: "failed", error_message: "Template required: window closed" } as never);
    expect((await sendPinResetWhatsapp(input())).status).toBe("sent");
    expect(tpl).toHaveBeenCalledTimes(1);
  });

  it("a window rejection with no template chosen sends nothing more", async () => {
    settings.mockResolvedValue(NO_TEMPLATE);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    text.mockRejectedValue(new AppError("Outside the 24 hour messaging window", 400));
    expect(await sendPinResetWhatsapp(input())).toEqual({ status: "skipped", reason: "no_template" });
  });

  it("any other failed message sends nothing more and reports send_failed", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    text.mockResolvedValue({ id: "m", conversation_id: "cv1", status: "failed", error_message: "Recipient blocked" } as never);
    expect(await sendPinResetWhatsapp(input())).toEqual({ status: "skipped", reason: "send_failed" });
    expect(tpl).not.toHaveBeenCalled();
  });
});

describe("window closed: the template", () => {
  it("closed (SendSeven says a template is required) in the customer's own chat: template with resolved variables to that chat", async () => {
    openChat({ requires_template: true });
    expect(await sendPinResetWhatsapp(input())).toEqual({ status: "sent", viaTemplate: true });
    expect(text).not.toHaveBeenCalled();
    const [name, body] = tpl.mock.calls[0];
    expect(name).toBe("portal_sign_in");
    expect(body).toMatchObject({
      conversation_id: "cv1",
      channel_id: "ch1",
      language: "en_GB",
      // Meta rejects empty parameters: the blank custom text became "-".
      variable_values: { "1": "Sam", "2": "Sunny Travel", "3": LINK, "4": "-" },
    });
    expect(body).not.toHaveProperty("contact_id");
  });

  it("empty values are replaced by fallbacks, never sent empty", async () => {
    openChat({ requires_template: true });
    org.mockResolvedValue({ name: "  " } as never);
    await sendPinResetWhatsapp(input({ firstName: null }));
    expect(tpl.mock.calls[0][1].variable_values).toMatchObject({ "1": "there", "2": "our team" });
  });

  it("the agency's chosen channel is used when it is still usable", async () => {
    settings.mockResolvedValue({ ...TEMPLATE, channelId: "ch2" });
    channels.mockResolvedValue([channel, { ...channel, id: "ch2" }] as never);
    link.mockResolvedValue(null);
    await sendPinResetWhatsapp(input());
    expect(tpl.mock.calls[0][1]).toMatchObject({ channel_id: "ch2" });
  });
});

describe("never to a number other than the customer's phone on file", () => {
  it("unlinked customer: the template goes to the phone on file, with no contact", async () => {
    link.mockResolvedValue(null);
    expect(await sendPinResetWhatsapp(input())).toEqual({ status: "sent", viaTemplate: true });
    expect(conv.checkExisting).not.toHaveBeenCalled();
    expect(tpl.mock.calls[0][1]).toMatchObject({ whatsapp_id: "447700900123" });
    expect(tpl.mock.calls[0][1]).not.toHaveProperty("contact_id");
    expect(tpl.mock.calls[0][1]).not.toHaveProperty("conversation_id", "cv1");
  });

  it("family-member case: the customer is linked to a chat whose number is someone else's: the plain text is NOT sent there; the template goes to the customer's own phone", async () => {
    openChat({ window_status: { in_window: true } }, "07911 123456");
    expect(await sendPinResetWhatsapp(input())).toEqual({ status: "sent", viaTemplate: true });
    expect(text).not.toHaveBeenCalled();
    const body = tpl.mock.calls[0][1];
    expect(body).toMatchObject({ whatsapp_id: "447700900123" });
    expect(body).not.toHaveProperty("contact_id");
    expect(body.conversation_id ?? null).toBeNull();
    expect(JSON.stringify(body)).not.toContain("cv1");
    expect(JSON.stringify(body)).not.toContain("7911123456");
  });

  it("family-member case with no template chosen: nothing is sent at all, and no link is reserved", async () => {
    settings.mockResolvedValue(NO_TEMPLATE);
    openChat({ window_status: { in_window: true } }, "07911 123456");
    const i = input();
    expect(await sendPinResetWhatsapp(i)).toEqual({ status: "skipped", reason: "no_template" });
    expect(text).not.toHaveBeenCalled();
    expect(tpl).not.toHaveBeenCalled();
    expect(i.reserve).not.toHaveBeenCalled();
  });

  it("a chat whose contact has no number we can read is treated as not the customer's", async () => {
    openChat({ window_status: { in_window: true } }, null);
    await sendPinResetWhatsapp(input());
    expect(text).not.toHaveBeenCalled();
    expect(tpl.mock.calls[0][1]).toMatchObject({ whatsapp_id: "447700900123" });
  });

  it("the same number written differently still matches (+44, 0, 44 forms)", async () => {
    openChat({ window_status: { in_window: true } }, "447700900123");
    expect((await sendPinResetWhatsapp(input())).status).toBe("sent");
    expect(text).toHaveBeenCalledTimes(1);
  });

  it("linked contact but no open chat: the template to the phone on file, never the contact", async () => {
    conv.checkExisting.mockResolvedValue({ has_existing_open: false, requires_template: true } as never);
    await sendPinResetWhatsapp(input());
    expect(conv.getById).not.toHaveBeenCalled();
    expect(conv.openOrCreate).not.toHaveBeenCalled();
    expect(tpl.mock.calls[0][1]).toMatchObject({ whatsapp_id: "447700900123" });
    expect(tpl.mock.calls[0][1]).not.toHaveProperty("contact_id");
  });
});

describe("nothing is sent, and nothing throws", () => {
  it("no template chosen and the window closed: no send, and no link reserved", async () => {
    settings.mockResolvedValue(NO_TEMPLATE);
    openChat({ requires_template: true });
    const i = input();
    expect(await sendPinResetWhatsapp(i)).toEqual({ status: "skipped", reason: "no_template" });
    expect(tpl).not.toHaveBeenCalled();
    expect(text).not.toHaveBeenCalled();
    expect(i.reserve).not.toHaveBeenCalled();
  });

  it("no template chosen and the customer unlinked: no send", async () => {
    settings.mockResolvedValue(NO_TEMPLATE);
    link.mockResolvedValue(null);
    const i = input();
    expect(await sendPinResetWhatsapp(i)).toEqual({ status: "skipped", reason: "no_template" });
    expect(i.reserve).not.toHaveBeenCalled();
  });

  it("WhatsApp not connected for the agency: nothing, and no fallback to another tenant's token", async () => {
    cfg.mockResolvedValue(null);
    const i = input();
    expect(await sendPinResetWhatsapp(i)).toEqual({ status: "skipped", reason: "not_configured" });
    expect(channels).not.toHaveBeenCalled();
    expect(i.reserve).not.toHaveBeenCalled();
  });

  it("no usable WhatsApp channel: nothing, no link reserved", async () => {
    channels.mockResolvedValue([{ ...channel, is_verified: false }] as never);
    const i = input();
    expect(await sendPinResetWhatsapp(i)).toEqual({ status: "skipped", reason: "no_channel" });
    expect(i.reserve).not.toHaveBeenCalled();
  });

  it("a cap reached (reserve returns null): nothing is sent", async () => {
    link.mockResolvedValue(null);
    const i = input({ reserve: vi.fn().mockResolvedValue(null) });
    expect(await sendPinResetWhatsapp(i)).toEqual({ status: "skipped", reason: "capped" });
    expect(tpl).not.toHaveBeenCalled();
    expect(text).not.toHaveBeenCalled();
  });

  it("the template send is refused: nothing more, reported as send_failed (the reserved link still counts)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    link.mockResolvedValue(null);
    tpl.mockResolvedValue({ success: false, message_id: null, external_id: null, conversation_id: "", error: "bad", error_code: 1, error_details: "Template paused" });
    const i = input();
    expect(await sendPinResetWhatsapp(i)).toEqual({ status: "skipped", reason: "send_failed" });
    expect(i.reserve).toHaveBeenCalledTimes(1);
  });

  it("a thrown SendSeven error is caught and reported as send_failed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    link.mockResolvedValue(null);
    tpl.mockRejectedValue(new AppError("SendSeven is down", 502));
    await expect(sendPinResetWhatsapp(input())).resolves.toEqual({ status: "skipped", reason: "send_failed" });
  });

  it("never calls the SMS sender", async () => {
    link.mockResolvedValue(null);
    await sendPinResetWhatsapp(input());
    expect(sendSms).not.toHaveBeenCalled();
  });
});

describe("who is recorded as the sender", () => {
  it("a customer's own forgotten-PIN request counts as an automatic send and runs no staff hook", async () => {
    openChat({ window_status: { in_window: true } });
    await sendPinResetWhatsapp(input());
    expect(usageService.recordSendsevenSend).toHaveBeenCalledWith({ orgId: "o1", source: "auto" });
    expect(messagesService.afterStaffSend).not.toHaveBeenCalled();
  });

  it("a staff send by text goes through the staff hook with the open conversation (usage, assignment, AI pause), not the automatic count", async () => {
    openChat({ window_status: { in_window: true } });
    await sendPinResetWhatsapp(input({ staffUserId: "u7" }));
    expect(messagesService.afterStaffSend).toHaveBeenCalledWith("o1", "cv1", "u7");
    expect(usageService.recordSendsevenSend).not.toHaveBeenCalled();
  });

  it("a staff send by template goes through the staff hook with the conversation the template opened", async () => {
    link.mockResolvedValue(null as never);
    await sendPinResetWhatsapp(input({ staffUserId: "u7" }));
    expect(tpl).toHaveBeenCalledTimes(1);
    expect(messagesService.afterStaffSend).toHaveBeenCalledWith("o1", "cv9", "u7");
    expect(usageService.recordSendsevenSend).not.toHaveBeenCalled();
  });
});
