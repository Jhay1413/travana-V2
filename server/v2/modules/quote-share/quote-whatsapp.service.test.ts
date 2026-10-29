import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./quote-share.service", () => ({ quoteShareService: { verifyAccess: vi.fn() } }));
vi.mock("../neon-client/neon-client.service", () => ({ neonClientService: { getNeonClientById: vi.fn() } }));
vi.mock("../contact-link/contact-link.service", () => ({ contactLinkService: { getByClient: vi.fn(), linkIfUnlinked: vi.fn() } }));
vi.mock("../channels/channels.service", () => ({ channelsService: { listChannels: vi.fn() } }));
vi.mock("../conversations/conversations.service", () => ({
  conversationsService: { checkExisting: vi.fn(), openOrCreate: vi.fn(), getById: vi.fn() },
}));
vi.mock("../messages/messages.service", () => ({ messagesService: { send: vi.fn(), afterStaffSend: vi.fn() } }));
vi.mock("../whatsapp-templates/whatsapp-settings.service", () => ({ whatsappSettingsService: { getQuote: vi.fn() } }));
vi.mock("../whatsapp-templates/whatsapp-templates.repository", () => ({ whatsappTemplatesRepository: { send: vi.fn() } }));
vi.mock("../user/user.repository", () => ({ userRepository: { findById: vi.fn() } }));
vi.mock("../organization/organization.repository", () => ({ organizationRepository: { findById: vi.fn() } }));
vi.mock("../../utils/sendseven", () => ({ isSendSevenConfigured: vi.fn() }));
vi.mock("../sms/sms.service", () => ({
  resolveQuoteToken: vi.fn(),
  buildPublicQuoteMessage: vi.fn(),
  // GB rules of the real normaliser, enough for the recipient tests below.
  normalisePhone: vi.fn((raw: string | null | undefined) => {
    const digits = raw ? String(raw).replace(/\D/g, "") : "";
    return digits ? "+" + digits.replace(/^0/, "44") : null;
  }),
}));

import { quoteWhatsappService } from "./quote-whatsapp.service";
import { quoteShareService } from "./quote-share.service";
import { neonClientService } from "../neon-client/neon-client.service";
import { contactLinkService } from "../contact-link/contact-link.service";
import { channelsService } from "../channels/channels.service";
import { conversationsService } from "../conversations/conversations.service";
import { messagesService } from "../messages/messages.service";
import { whatsappSettingsService } from "../whatsapp-templates/whatsapp-settings.service";
import { whatsappTemplatesRepository } from "../whatsapp-templates/whatsapp-templates.repository";
import { userRepository } from "../user/user.repository";
import { organizationRepository } from "../organization/organization.repository";
import type { QuoteTemplateSettings } from "./quote-share.types";
import { isSendSevenConfigured } from "../../utils/sendseven";
import { buildPublicQuoteMessage, resolveQuoteToken } from "../sms/sms.service";
import { AppError } from "../../utils/error-handler";
import type { Scope } from "../../utils/scope";

const scope = (over: Partial<Scope> = {}): Scope => ({
  orgId: "o1", branchId: null, orgRole: "agent", orgRoles: ["agent"], userId: "u1",
  branchType: null, ownsHomeworkerBranch: false, ...over,
});

const MSG = { text: "Hi Ann, your quote is ready - tap to view it: https://x/view-quote/tok - Tina's Travel", quoteUrl: "https://x/view-quote/tok" };
const WA = { id: "ch1", channel_type: "whatsapp", is_active: true, is_verified: true };

// The duplicate guard is module-level state, so each test gets its own quote id.
let seq = 0;
function send(s: Scope = scope(), quoteId = `q${++seq}`) {
  return quoteWhatsappService.send(quoteId, "c1", "u1", s);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(quoteShareService.verifyAccess).mockResolvedValue(undefined);
  vi.mocked(neonClientService.getNeonClientById).mockResolvedValue({ id: "c1", firstName: "Ann" } as never);
  vi.mocked(resolveQuoteToken).mockResolvedValue({ id: "q1", token: "tok" });
  vi.mocked(buildPublicQuoteMessage).mockReturnValue(MSG);
  vi.mocked(isSendSevenConfigured).mockReturnValue(true);
  vi.mocked(contactLinkService.getByClient).mockResolvedValue({ clientId: "c1", contactId: "k1", linkedAt: null });
  vi.mocked(channelsService.listChannels).mockResolvedValue([WA] as never);
  vi.mocked(conversationsService.checkExisting).mockResolvedValue({
    has_existing_open: true, existing_open_conversation_id: "conv1", window_status: { in_window: true },
  });
  vi.mocked(messagesService.send).mockResolvedValue({ status: "sent" } as never);
  vi.mocked(whatsappSettingsService.getQuote).mockResolvedValue(NO_TEMPLATE);
});

const NO_TEMPLATE: QuoteTemplateSettings = { templateName: null, templateLanguage: null, channelId: null, variables: {} };
const CLOSED = { has_existing_open: true, existing_open_conversation_id: "conv1", window_status: { in_window: false } };
const NEW_TEMPLATE_SETTINGS: QuoteTemplateSettings = {
  templateName: "quote_ready", templateLanguage: "en_GB", channelId: null, variables: { "1": { source: "client_first_name" } },
};
const OK_TEMPLATE = {
  success: true, message_id: "m1", external_id: "e1", conversation_id: "conv9", error: null, error_code: null, error_details: null,
};

describe("quoteWhatsappService.send - closed window template", () => {
  beforeEach(() => {
    vi.mocked(conversationsService.checkExisting).mockResolvedValue(CLOSED);
    vi.mocked(whatsappSettingsService.getQuote).mockResolvedValue({
      templateName: "quote_ready",
      templateLanguage: "en_GB",
      channelId: null,
      variables: {
        "1": { source: "client_first_name" },
        "2": { source: "agent_name" },
        "3": { source: "agency_name" },
        "4": { source: "quote_link" },
        "5": { source: "custom", text: "Thanks!" },
      },
    });
    vi.mocked(whatsappTemplatesRepository.send).mockResolvedValue(OK_TEMPLATE);
    vi.mocked(userRepository.findById).mockResolvedValue({ name: "Sam Agent", email: "sam@x.com" } as never);
    vi.mocked(organizationRepository.findById).mockResolvedValue({ name: "Tina's Travel" } as never);
  });

  it("without settings keeps the window_closed fallback and sends nothing", async () => {
    vi.mocked(whatsappSettingsService.getQuote).mockResolvedValue(NO_TEMPLATE);
    await expect(send()).resolves.toEqual({ status: "fallback", reason: "window_closed", ...MSG });
    expect(whatsappTemplatesRepository.send).not.toHaveBeenCalled();
  });

  it("sends the template with all five variable sources resolved", async () => {
    await expect(send()).resolves.toEqual({ status: "sent", conversationId: "conv9", viaTemplate: true });
    // An open conversation is the recipient on its own: no contact_id, so SendSeven
    // never looks for a WhatsApp method on the contact record.
    expect(whatsappTemplatesRepository.send).toHaveBeenCalledWith("quote_ready", {
      channel_id: "ch1",
      conversation_id: "conv1",
      language: "en_GB",
      variable_values: { "1": "Ann", "2": "Sam Agent", "3": "Tina's Travel", "4": MSG.quoteUrl, "5": "Thanks!" },
    });
    expect(messagesService.send).not.toHaveBeenCalled();
  });

  it("with no open conversation sends to the contact, adding the client's phone as the WhatsApp id", async () => {
    vi.mocked(conversationsService.checkExisting).mockResolvedValue({ has_existing_open: false, requires_template: true });
    vi.mocked(neonClientService.getNeonClientById).mockResolvedValue({ id: "c1", firstName: "Ann", phoneNumber: "07700 900123" } as never);
    vi.mocked(whatsappSettingsService.getQuote).mockResolvedValue({
      templateName: "quote_ready", templateLanguage: null, channelId: null, variables: {},
    });
    await expect(send()).resolves.toMatchObject({ status: "sent", viaTemplate: true });
    expect(whatsappTemplatesRepository.send).toHaveBeenCalledWith("quote_ready", {
      contact_id: "k1", whatsapp_id: "447700900123", conversation_id: null, channel_id: "ch1", language: undefined, variable_values: {},
    });
  });

  it("with no open conversation and no client phone sends to the contact alone", async () => {
    vi.mocked(conversationsService.checkExisting).mockResolvedValue({ has_existing_open: false, requires_template: true });
    vi.mocked(whatsappSettingsService.getQuote).mockResolvedValue({
      templateName: "quote_ready", templateLanguage: null, channelId: null, variables: {},
    });
    await expect(send()).resolves.toMatchObject({ status: "sent", viaTemplate: true });
    const [, body] = vi.mocked(whatsappTemplatesRepository.send).mock.calls[0];
    expect(body).toEqual({ contact_id: "k1", conversation_id: null, channel_id: "ch1", language: undefined, variable_values: {} });
    expect(body).not.toHaveProperty("whatsapp_id");
  });

  it("with no linked contact sends the template to the client's phone number alone", async () => {
    vi.mocked(contactLinkService.getByClient).mockResolvedValue({ clientId: "c1", contactId: null, linkedAt: null });
    vi.mocked(neonClientService.getNeonClientById).mockResolvedValue({ id: "c1", firstName: "Ann", phoneNumber: "07700 900123" } as never);
    vi.mocked(whatsappSettingsService.getQuote).mockResolvedValue({
      templateName: "quote_ready", templateLanguage: "en_GB", channelId: null, variables: { "1": { source: "client_first_name" } },
    });
    await expect(send()).resolves.toEqual({ status: "sent", conversationId: "conv9", viaTemplate: true });
    expect(whatsappTemplatesRepository.send).toHaveBeenCalledWith("quote_ready", {
      whatsapp_id: "447700900123", channel_id: "ch1", language: "en_GB", variable_values: { "1": "Ann" },
    });
    // Nothing to look up or reopen without a contact.
    expect(conversationsService.checkExisting).not.toHaveBeenCalled();
    expect(conversationsService.openOrCreate).not.toHaveBeenCalled();
    expect(messagesService.send).not.toHaveBeenCalled();
  });

  it("with no linked contact, links the client to the contact SendSeven created (best-effort)", async () => {
    vi.mocked(contactLinkService.getByClient).mockResolvedValue({ clientId: "c1", contactId: null, linkedAt: null });
    vi.mocked(neonClientService.getNeonClientById).mockResolvedValue({ id: "c1", firstName: "Ann", phoneNumber: "07700 900123" } as never);
    vi.mocked(conversationsService.getById).mockResolvedValue({ id: "conv9", contact_id: "k9" } as never);
    vi.mocked(whatsappSettingsService.getQuote).mockResolvedValue(NEW_TEMPLATE_SETTINGS);
    const s = scope();
    await expect(send(s)).resolves.toMatchObject({ status: "sent", viaTemplate: true });
    expect(conversationsService.getById).toHaveBeenCalledWith("o1", "conv9");
    expect(contactLinkService.linkIfUnlinked).toHaveBeenCalledWith("k9", "c1", s);
  });

  it("still reports sent when the auto-link fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.mocked(contactLinkService.getByClient).mockResolvedValue({ clientId: "c1", contactId: null, linkedAt: null });
    vi.mocked(neonClientService.getNeonClientById).mockResolvedValue({ id: "c1", firstName: "Ann", phoneNumber: "07700 900123" } as never);
    vi.mocked(conversationsService.getById).mockResolvedValue({ id: "conv9", contact_id: "k9" } as never);
    vi.mocked(contactLinkService.linkIfUnlinked).mockRejectedValue(new Error("already linked"));
    vi.mocked(whatsappSettingsService.getQuote).mockResolvedValue(NEW_TEMPLATE_SETTINGS);
    await expect(send()).resolves.toMatchObject({ status: "sent", viaTemplate: true });
  });

  it("does not try to link when the client already had a contact", async () => {
    await send();
    expect(contactLinkService.linkIfUnlinked).not.toHaveBeenCalled();
  });

  it("with no linked contact and no client phone falls back no_contact without sending", async () => {
    vi.mocked(contactLinkService.getByClient).mockResolvedValue({ clientId: "c1", contactId: null, linkedAt: null });
    vi.mocked(neonClientService.getNeonClientById).mockResolvedValue({ id: "c1", firstName: "Ann", phoneNumber: "" } as never);
    await expect(send()).resolves.toEqual({ status: "fallback", reason: "no_contact", ...MSG });
    expect(whatsappTemplatesRepository.send).not.toHaveBeenCalled();
  });

  it("prefers the saved channel when it is eligible, using it for every SendSeven call", async () => {
    const ch2 = { id: "ch2", channel_type: "whatsapp", is_active: true, is_verified: true };
    vi.mocked(channelsService.listChannels).mockResolvedValue([WA, ch2] as never);
    vi.mocked(whatsappSettingsService.getQuote).mockResolvedValue({
      templateName: "quote_ready", templateLanguage: null, channelId: "ch2", variables: {},
    });
    vi.mocked(conversationsService.checkExisting).mockResolvedValue({ has_existing_open: false, requires_template: true });
    await send();
    expect(conversationsService.checkExisting).toHaveBeenCalledWith({ contact_id: "k1", channel_id: "ch2" });
    expect(vi.mocked(whatsappTemplatesRepository.send).mock.calls[0][1].channel_id).toBe("ch2");
  });

  it("falls back to the first eligible channel when the saved one is missing or inactive", async () => {
    const off = { id: "ch2", channel_type: "whatsapp", is_active: false, is_verified: true };
    vi.mocked(channelsService.listChannels).mockResolvedValue([off, WA] as never);
    for (const saved of ["ch2", "gone"]) {
      vi.mocked(whatsappTemplatesRepository.send).mockClear();
      vi.mocked(whatsappSettingsService.getQuote).mockResolvedValue({
        templateName: "quote_ready", templateLanguage: null, channelId: saved, variables: {},
      });
      await send();
      expect(vi.mocked(whatsappTemplatesRepository.send).mock.calls[0][1].channel_id).toBe("ch1");
    }
  });

  it("runs the staff-send side effects after a template send (it used to skip them)", async () => {
    await send();
    expect(messagesService.afterStaffSend).toHaveBeenCalledWith("o1", "conv9", "u1");
  });

  it("does not run them when the template was rejected", async () => {
    vi.mocked(whatsappTemplatesRepository.send).mockResolvedValue({ ...OK_TEMPLATE, success: false, error: "bad" });
    await send();
    expect(messagesService.afterStaffSend).not.toHaveBeenCalled();
  });

  it("treats a null window_status as unknown and tries free text first", async () => {
    vi.mocked(conversationsService.checkExisting).mockResolvedValue({
      has_existing_open: true, existing_open_conversation_id: "conv1", window_status: null,
    });
    await expect(send()).resolves.toEqual({ status: "sent", conversationId: "conv1" });
    expect(whatsappTemplatesRepository.send).not.toHaveBeenCalled();
  });

  it("goes to the template when only window_status.requires_template is set", async () => {
    vi.mocked(conversationsService.checkExisting).mockResolvedValue({
      has_existing_open: true, existing_open_conversation_id: "conv1", window_status: { requires_template: true },
    });
    await expect(send()).resolves.toMatchObject({ viaTemplate: true });
  });

  it("loads the settings once per send", async () => {
    await send();
    expect(whatsappSettingsService.getQuote).toHaveBeenCalledTimes(1);
  });

  it("does not leak non-AppError messages into the fallback detail, and logs them", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(whatsappTemplatesRepository.send).mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.1"));
    await expect(send()).resolves.toMatchObject({ reason: "template_failed", detail: "unknown error" });
    expect(spy).toHaveBeenCalledWith("[quote-whatsapp] template send failed", expect.any(Error));
    spy.mockRestore();
  });

  it("surfaces a DB failure while resolving variables as an error, not a template fallback", async () => {
    vi.mocked(userRepository.findById).mockRejectedValue(new Error("db down"));
    await expect(send()).rejects.toThrow("db down");
    expect(whatsappTemplatesRepository.send).not.toHaveBeenCalled();
  });

  it("falls back to safe values for empty first name, missing user name and org name", async () => {
    vi.mocked(neonClientService.getNeonClientById).mockResolvedValue({ id: "c1", firstName: "  " } as never);
    vi.mocked(userRepository.findById).mockResolvedValue({ name: null, email: "pat@x.com" } as never);
    vi.mocked(organizationRepository.findById).mockResolvedValue(null);
    await send();
    const body = vi.mocked(whatsappTemplatesRepository.send).mock.calls[0][1];
    expect(body.variable_values).toMatchObject({ "1": "there", "2": "pat", "3": "our team" });

    vi.mocked(whatsappTemplatesRepository.send).mockClear();
    vi.mocked(userRepository.findById).mockResolvedValue(undefined);
    await send();
    expect(vi.mocked(whatsappTemplatesRepository.send).mock.calls[0][1].variable_values?.["2"]).toBe("your travel agent");
  });

  it("only loads the user and org when a variable needs them", async () => {
    vi.mocked(whatsappSettingsService.getQuote).mockResolvedValue({
      templateName: "quote_ready", templateLanguage: null, channelId: null, variables: { "1": { source: "quote_link" } },
    });
    await send();
    expect(userRepository.findById).not.toHaveBeenCalled();
    expect(organizationRepository.findById).not.toHaveBeenCalled();
  });

  it("reports template_failed with the SendSeven detail when success is false", async () => {
    vi.mocked(whatsappTemplatesRepository.send).mockResolvedValue({ ...OK_TEMPLATE, success: false, error: "bad", error_details: "param 2 empty" });
    await expect(send()).resolves.toEqual({ status: "fallback", reason: "template_failed", detail: "param 2 empty", ...MSG });
    vi.mocked(whatsappTemplatesRepository.send).mockResolvedValue({ ...OK_TEMPLATE, success: false, error: "bad" });
    await expect(send()).resolves.toMatchObject({ reason: "template_failed", detail: "bad" });
    vi.mocked(whatsappTemplatesRepository.send).mockResolvedValue({ ...OK_TEMPLATE, success: false });
    await expect(send()).resolves.toMatchObject({ reason: "template_failed", detail: "unknown error" });
  });

  it("reports template_failed when the transport throws", async () => {
    vi.mocked(whatsappTemplatesRepository.send).mockRejectedValue(new AppError("Failed to reach the SendSeven service", 502));
    await expect(send()).resolves.toMatchObject({ status: "fallback", reason: "template_failed", detail: "Failed to reach the SendSeven service" });
  });

  it("applies the 60s duplicate guard to template sends, and does not arm it on failure", async () => {
    await expect(send(scope(), "tpl-dup")).resolves.toMatchObject({ viaTemplate: true });
    await expect(send(scope(), "tpl-dup")).rejects.toMatchObject({ statusCode: 429 });
    expect(whatsappTemplatesRepository.send).toHaveBeenCalledTimes(1);

    vi.mocked(whatsappTemplatesRepository.send).mockRejectedValueOnce(new Error("boom"));
    await expect(send(scope(), "tpl-retry")).resolves.toMatchObject({ reason: "template_failed" });
    await expect(send(scope(), "tpl-retry")).resolves.toMatchObject({ status: "sent" });
  });

  it("sends a template when the free-text send is rejected for the window", async () => {
    vi.mocked(conversationsService.checkExisting).mockResolvedValue({
      has_existing_open: true, existing_open_conversation_id: "conv1", window_status: { in_window: true },
    });
    vi.mocked(messagesService.send).mockRejectedValue(new AppError("Outside the 24-hour window", 400));
    await expect(send()).resolves.toMatchObject({ status: "sent", viaTemplate: true });
  });

  it("leaves the in-window free-text path untouched", async () => {
    vi.mocked(conversationsService.checkExisting).mockResolvedValue({
      has_existing_open: true, existing_open_conversation_id: "conv1", window_status: { in_window: true },
    });
    await expect(send()).resolves.toEqual({ status: "sent", conversationId: "conv1" });
    expect(whatsappTemplatesRepository.send).not.toHaveBeenCalled();
  });
});

describe("quoteWhatsappService.send", () => {
  it("sends the text into the existing open conversation", async () => {
    await expect(send()).resolves.toEqual({ status: "sent", conversationId: "conv1" });
    expect(buildPublicQuoteMessage).toHaveBeenCalledWith({ firstName: "Ann", token: "tok" });
    expect(messagesService.send).toHaveBeenCalledWith(
      "o1",
      { conversation_id: "conv1", channel_id: "ch1", message_type: "text", text: MSG.text },
      "u1",
    );
    expect(conversationsService.openOrCreate).not.toHaveBeenCalled();
  });

  it("opens a conversation when none is open, then sends", async () => {
    vi.mocked(conversationsService.checkExisting).mockResolvedValue({ has_existing_open: false, window_status: { in_window: true } });
    vi.mocked(conversationsService.openOrCreate).mockResolvedValue({ conversation_id: "conv2", window_status: { in_window: true } });
    await expect(send()).resolves.toEqual({ status: "sent", conversationId: "conv2" });
    expect(conversationsService.openOrCreate).toHaveBeenCalledWith({ contact_id: "k1", channel_id: "ch1", reopen_existing: true });
  });

  it("rejects a quote that is not the client's, before touching SendSeven", async () => {
    vi.mocked(resolveQuoteToken).mockRejectedValue(new AppError("Quote does not belong to this client", 400));
    await expect(send()).rejects.toMatchObject({ statusCode: 400 });
    expect(contactLinkService.getByClient).not.toHaveBeenCalled();
    expect(messagesService.send).not.toHaveBeenCalled();
  });

  it("propagates access and client-scope failures", async () => {
    vi.mocked(quoteShareService.verifyAccess).mockRejectedValue(new AppError("Quote not found", 404));
    await expect(send()).rejects.toMatchObject({ statusCode: 404 });
    vi.mocked(quoteShareService.verifyAccess).mockResolvedValue(undefined);
    vi.mocked(neonClientService.getNeonClientById).mockRejectedValue(new AppError("Client not found", 404));
    await expect(send()).rejects.toMatchObject({ statusCode: 404 });
    expect(messagesService.send).not.toHaveBeenCalled();
  });

  it("homeworkers get not_allowed and SendSeven is never touched", async () => {
    for (const s of [scope({ orgRole: "homeworker", orgRoles: ["homeworker"] }), scope({ orgRole: "agent", orgRoles: ["agent", "homeworker"] })]) {
      await expect(send(s)).resolves.toEqual({ status: "fallback", reason: "not_allowed", ...MSG });
    }
    expect(isSendSevenConfigured).not.toHaveBeenCalled();
    expect(contactLinkService.getByClient).not.toHaveBeenCalled();
    expect(channelsService.listChannels).not.toHaveBeenCalled();
    expect(messagesService.send).not.toHaveBeenCalled();
  });

  it("falls back not_configured when SendSeven is not set up for the org", async () => {
    vi.mocked(isSendSevenConfigured).mockReturnValue(false);
    await expect(send()).resolves.toEqual({ status: "fallback", reason: "not_configured", ...MSG });
    expect(messagesService.send).not.toHaveBeenCalled();
  });

  it("falls back no_contact when the client has no linked contact and no template is configured", async () => {
    vi.mocked(contactLinkService.getByClient).mockResolvedValue({ clientId: "c1", contactId: null, linkedAt: null });
    vi.mocked(neonClientService.getNeonClientById).mockResolvedValue({ id: "c1", firstName: "Ann", phoneNumber: "07700 900123" } as never);
    await expect(send()).resolves.toEqual({ status: "fallback", reason: "no_contact", ...MSG });
    expect(whatsappTemplatesRepository.send).not.toHaveBeenCalled();
    expect(conversationsService.checkExisting).not.toHaveBeenCalled();
  });

  it("falls back no_channel when there is no active, verified WhatsApp channel", async () => {
    vi.mocked(channelsService.listChannels).mockResolvedValue([
      { id: "a", channel_type: "messenger", is_active: true, is_verified: true },
      { id: "b", channel_type: "whatsapp", is_active: false, is_verified: true },
      { id: "c", channel_type: "whatsapp", is_active: true, is_verified: false },
    ] as never);
    await expect(send()).resolves.toEqual({ status: "fallback", reason: "no_channel", ...MSG });
  });

  it("falls back window_closed when check-existing says a template is needed", async () => {
    vi.mocked(conversationsService.checkExisting).mockResolvedValue({
      has_existing_open: true, existing_open_conversation_id: "conv1", window_status: { in_window: false },
    });
    await expect(send()).resolves.toEqual({ status: "fallback", reason: "window_closed", ...MSG });
    expect(messagesService.send).not.toHaveBeenCalled();
    expect(conversationsService.openOrCreate).not.toHaveBeenCalled();
  });

  it("does not reopen a conversation when check-existing already says the window is closed", async () => {
    vi.mocked(conversationsService.checkExisting).mockResolvedValue({
      has_existing_open: false, requires_template: true,
    });
    await expect(send()).resolves.toMatchObject({ status: "fallback", reason: "window_closed" });
    expect(conversationsService.openOrCreate).not.toHaveBeenCalled();
  });

  it("falls back window_closed when open-or-create says a template is needed", async () => {
    vi.mocked(conversationsService.checkExisting).mockResolvedValue({ has_existing_open: false });
    vi.mocked(conversationsService.openOrCreate).mockResolvedValue({ conversation_id: "conv2", requires_template: true });
    await expect(send()).resolves.toEqual({ status: "fallback", reason: "window_closed", ...MSG });
    expect(messagesService.send).not.toHaveBeenCalled();
  });

  it("maps a window/template rejection from the send to window_closed", async () => {
    vi.mocked(messagesService.send).mockRejectedValue(
      new AppError("Outside the 24-hour window: a template message is required", 400),
    );
    await expect(send()).resolves.toEqual({ status: "fallback", reason: "window_closed", ...MSG });
  });

  it("propagates other send failures", async () => {
    vi.mocked(messagesService.send).mockRejectedValue(new AppError("Failed to reach the SendSeven service", 502));
    await expect(send()).rejects.toMatchObject({ statusCode: 502 });
    vi.mocked(messagesService.send).mockRejectedValue(new AppError("Invalid token", 401));
    await expect(send()).rejects.toMatchObject({ statusCode: 401 });
  });

  it("does not treat an unrelated message that merely mentions a template as a window rejection", async () => {
    vi.mocked(messagesService.send).mockRejectedValue(new AppError("Invalid template parameter", 400));
    await expect(send()).rejects.toMatchObject({ statusCode: 400 });
  });

  it("maps a failed send result with a window reason to window_closed", async () => {
    vi.mocked(messagesService.send).mockResolvedValue({
      status: "failed", error_message: "Message failed: outside the 24 hour window",
    } as never);
    await expect(send()).resolves.toMatchObject({ status: "fallback", reason: "window_closed" });
  });

  it("throws (never reports sent) when the send result failed for another reason", async () => {
    vi.mocked(messagesService.send).mockResolvedValue({ status: "failed", error_message: "Number not on WhatsApp" } as never);
    await expect(send()).rejects.toMatchObject({ statusCode: 502 });
    vi.mocked(messagesService.send).mockResolvedValue({ status: "sent", error_message: "boom" } as never);
    await expect(send()).rejects.toMatchObject({ statusCode: 502 });
  });

  it("blocks an immediate repeat send with a 429, but not a different quote", async () => {
    await expect(send(scope(), "dup-q")).resolves.toMatchObject({ status: "sent" });
    await expect(send(scope(), "dup-q")).rejects.toMatchObject({ statusCode: 429 });
    expect(messagesService.send).toHaveBeenCalledTimes(1);
    await expect(send(scope(), "other-q")).resolves.toMatchObject({ status: "sent" });
  });

  it("does not arm the duplicate guard after a failed send or a fallback", async () => {
    vi.mocked(messagesService.send).mockResolvedValue({ status: "failed", error_message: "nope" } as never);
    await expect(send(scope(), "retry-q")).rejects.toMatchObject({ statusCode: 502 });
    vi.mocked(messagesService.send).mockResolvedValue({ status: "sent" } as never);
    await expect(send(scope(), "retry-q")).resolves.toMatchObject({ status: "sent" });
  });
});
