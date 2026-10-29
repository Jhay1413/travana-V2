import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../neon-client/neon-client.service", () => ({ neonClientService: { getNeonClientById: vi.fn() } }));
vi.mock("../contact-link/contact-link.service", () => ({ contactLinkService: { getByClient: vi.fn(), getStatus: vi.fn(), linkIfUnlinked: vi.fn() } }));
vi.mock("../channels/channels.service", () => ({ channelsService: { listChannels: vi.fn() } }));
vi.mock("../conversations/conversations.service", () => ({
  conversationsService: { checkExisting: vi.fn(), openOrCreate: vi.fn(), getById: vi.fn(), getWhatsappWindow: vi.fn() },
}));
vi.mock("../messages/messages.service", () => ({ messagesService: { send: vi.fn(), afterStaffSend: vi.fn() } }));
vi.mock("../whatsapp-templates/whatsapp-settings.service", () => ({ whatsappSettingsService: { getUpdate: vi.fn(), saveUpdate: vi.fn() } }));
vi.mock("../whatsapp-templates/whatsapp-templates.repository", () => ({ whatsappTemplatesRepository: { send: vi.fn() } }));
vi.mock("../user/user.repository", () => ({ userRepository: { findById: vi.fn() } }));
vi.mock("../organization/organization.repository", () => ({ organizationRepository: { findById: vi.fn() } }));
vi.mock("../sms/sms.service", () => ({
  normalisePhone: vi.fn((raw: string | null | undefined) => {
    const digits = raw ? String(raw).replace(/\D/g, "") : "";
    return digits ? "+" + digits.replace(/^0/, "44") : null;
  }),
}));

import { whatsappUpdatesService } from "./whatsapp-updates.service";
import { neonClientService } from "../neon-client/neon-client.service";
import { contactLinkService } from "../contact-link/contact-link.service";
import { channelsService } from "../channels/channels.service";
import { conversationsService } from "../conversations/conversations.service";
import { messagesService } from "../messages/messages.service";
import { whatsappSettingsService } from "../whatsapp-templates/whatsapp-settings.service";
import { whatsappTemplatesRepository } from "../whatsapp-templates/whatsapp-templates.repository";
import { userRepository } from "../user/user.repository";
import { organizationRepository } from "../organization/organization.repository";
import { AppError } from "../../utils/error-handler";
import type { Scope } from "../../utils/scope";

const scope = (over: Partial<Scope> = {}): Scope => ({
  orgId: "o1", branchId: null, orgRole: "agent", orgRoles: ["agent"], userId: "u1",
  branchType: null, ownsHomeworkerBranch: false, ...over,
});

const WA = { id: "ch1", channel_type: "whatsapp", is_active: true, is_verified: true };
const SETTINGS = {
  templateName: "general_update",
  templateLanguage: "en_GB",
  channelId: "ch1",
  variables: {
    "1": { source: "client_first_name" as const },
    "2": { source: "agent_name" as const },
    "3": { source: "agency_name" as const },
    "4": { source: "message" as const },
  },
};
const NO_TEMPLATE = { templateName: null, templateLanguage: null, channelId: null, variables: {} };
const OK_TEMPLATE = { success: true, message_id: "m1", external_id: "e1", conversation_id: "conv9", error: null, error_code: null, error_details: null };
const OPEN_WINDOW = { inWindow: true, requiresTemplate: false, remainingSeconds: 100, windowEndAt: "2026-01-01T00:00:00Z", lastCustomerMessageAt: "2025-12-31T00:00:00Z", windowType: "customer_service" };
const CLOSED_WINDOW = { ...OPEN_WINDOW, inWindow: false, requiresTemplate: true, remainingSeconds: 0 };

// The duplicate guard is module-level state, so each test sends different text.
let seq = 0;
const uniqueText = () => `Your transfer moved ${++seq}\nsecond line`;

function sendConv(text = uniqueText(), s: Scope = scope()) {
  return whatsappUpdatesService.sendToConversation("conv1", text, "u1", s);
}
function sendClient(text = uniqueText(), s: Scope = scope(), channelId = "ch1") {
  return whatsappUpdatesService.sendToClient("c1", channelId, text, "u1", s);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.mocked(conversationsService.getById).mockResolvedValue({
    id: "conv1", tenant_id: "t", channel_id: "ch1", status: "open", created_at: "x", channel_type: "whatsapp", contact_id: "k1", contact: { first_name: "Ann" },
  } as never);
  vi.mocked(conversationsService.getWhatsappWindow).mockResolvedValue(CLOSED_WINDOW);
  vi.mocked(contactLinkService.getStatus).mockResolvedValue({ contactId: "k1", linkedClient: null, suggestions: [], suggestionMatch: "contact" } as never);
  vi.mocked(whatsappSettingsService.getUpdate).mockResolvedValue(SETTINGS);
  vi.mocked(whatsappTemplatesRepository.send).mockResolvedValue(OK_TEMPLATE);
  vi.mocked(messagesService.send).mockResolvedValue({ status: "sent" } as never);
  vi.mocked(userRepository.findById).mockResolvedValue({ name: "Tina Agent" } as never);
  vi.mocked(organizationRepository.findById).mockResolvedValue({ name: "Tina's Travel" } as never);
  vi.mocked(neonClientService.getNeonClientById).mockResolvedValue({ id: "c1", firstName: "Ann", phoneNumber: "07123 456789" } as never);
  vi.mocked(contactLinkService.getByClient).mockResolvedValue({ clientId: "c1", contactId: "k1", linkedAt: null });
  vi.mocked(channelsService.listChannels).mockResolvedValue([WA] as never);
  vi.mocked(conversationsService.checkExisting).mockResolvedValue({
    has_existing_open: true, existing_open_conversation_id: "conv1", window_status: { in_window: true },
  });
});

describe("getWindow", () => {
  it("maps a known window", async () => {
    vi.mocked(conversationsService.getWhatsappWindow).mockResolvedValue(OPEN_WINDOW);
    expect(await whatsappUpdatesService.getWindow("conv1")).toEqual({
      known: true, inWindow: true, requiresTemplate: false, remainingSeconds: 100,
      windowEndAt: "2026-01-01T00:00:00Z", lastCustomerMessageAt: "2025-12-31T00:00:00Z",
    });
  });

  it("answers { known: false } when SendSeven errors", async () => {
    vi.mocked(conversationsService.getWhatsappWindow).mockRejectedValue(new AppError("down", 502));
    expect(await whatsappUpdatesService.getWindow("conv1")).toEqual({ known: false });
  });
});

describe("getTemplateStatus", () => {
  it("reports configured only when a template is chosen", async () => {
    expect(await whatsappUpdatesService.getTemplateStatus("o1")).toEqual({ configured: true, templateName: "general_update", channelId: "ch1" });
    vi.mocked(whatsappSettingsService.getUpdate).mockResolvedValue(NO_TEMPLATE);
    expect(await whatsappUpdatesService.getTemplateStatus("o1")).toEqual({ configured: false, templateName: null, channelId: null });
  });
});

describe("sendToConversation", () => {
  it("open window: sends raw trimmed text as a normal message", async () => {
    vi.mocked(conversationsService.getWhatsappWindow).mockResolvedValue(OPEN_WINDOW);
    const r = await sendConv("  line one\nline two  ");
    expect(r).toEqual({ conversationId: "conv1", viaTemplate: false });
    expect(messagesService.send).toHaveBeenCalledWith("o1", { conversation_id: "conv1", channel_id: "ch1", message_type: "text", text: "line one\nline two" }, "u1");
    expect(whatsappTemplatesRepository.send).not.toHaveBeenCalled();
  });

  it("closed window: sends the template with a sanitized message and runs afterStaffSend", async () => {
    const r = await sendConv("Moved to 10:30\nSee you there");
    expect(r).toEqual({ conversationId: "conv9", viaTemplate: true });
    expect(messagesService.send).not.toHaveBeenCalled();
    expect(whatsappTemplatesRepository.send).toHaveBeenCalledWith("general_update", {
      conversation_id: "conv1",
      channel_id: "ch1",
      language: "en_GB",
      variable_values: { "1": "Ann", "2": "Tina Agent", "3": "Tina's Travel", "4": "Moved to 10:30 See you there" },
    });
    expect(messagesService.afterStaffSend).toHaveBeenCalledWith("o1", "conv9", "u1");
  });

  it("greets by the linked Travana client's first name, then falls back to 'there'", async () => {
    vi.mocked(contactLinkService.getStatus).mockResolvedValue({ contactId: "k1", linkedClient: { firstName: "Annabel" } } as never);
    await sendConv();
    expect(vi.mocked(whatsappTemplatesRepository.send).mock.calls[0][1].variable_values?.["1"]).toBe("Annabel");

    vi.mocked(conversationsService.getById).mockResolvedValue({
      id: "conv1", channel_id: "ch1", channel_type: "whatsapp", contact_id: null, contact: null,
    } as never);
    vi.mocked(contactLinkService.getStatus).mockResolvedValue({ linkedClient: null } as never);
    await sendConv();
    expect(vi.mocked(whatsappTemplatesRepository.send).mock.calls[1][1].variable_values?.["1"]).toBe("there");
  });

  it("unknown window: tries free text and does not use the template when it works", async () => {
    vi.mocked(conversationsService.getWhatsappWindow).mockRejectedValue(new AppError("down", 502));
    const r = await sendConv();
    expect(r.viaTemplate).toBe(false);
    expect(messagesService.send).toHaveBeenCalled();
    expect(whatsappTemplatesRepository.send).not.toHaveBeenCalled();
  });

  it("unknown window + window rejection: falls back to the template", async () => {
    vi.mocked(conversationsService.getWhatsappWindow).mockRejectedValue(new AppError("down", 502));
    vi.mocked(messagesService.send).mockRejectedValue(new AppError("Outside the 24-hour messaging window", 400));
    const r = await sendConv();
    expect(r).toEqual({ conversationId: "conv9", viaTemplate: true });
  });

  it("open window but the free send reports a window failure on the message: falls back to the template", async () => {
    vi.mocked(conversationsService.getWhatsappWindow).mockResolvedValue(OPEN_WINDOW);
    vi.mocked(messagesService.send).mockResolvedValue({ status: "failed", error_message: "24 hour window closed" } as never);
    expect((await sendConv()).viaTemplate).toBe(true);
  });

  it("a non-window free-text failure is rethrown, not templated", async () => {
    vi.mocked(conversationsService.getWhatsappWindow).mockResolvedValue(OPEN_WINDOW);
    vi.mocked(messagesService.send).mockRejectedValue(new AppError("Unauthorized", 401));
    await expect(sendConv()).rejects.toMatchObject({ statusCode: 401 });
    expect(whatsappTemplatesRepository.send).not.toHaveBeenCalled();
  });

  it("400s on a non-WhatsApp conversation", async () => {
    vi.mocked(conversationsService.getById).mockResolvedValue({ id: "conv1", channel_id: "ch1", channel_type: "email" } as never);
    await expect(sendConv()).rejects.toMatchObject({ statusCode: 400, message: "Updates can only be sent on WhatsApp" });
    expect(messagesService.send).not.toHaveBeenCalled();
  });

  it("409 update_template_missing when the window is closed and no template is set", async () => {
    vi.mocked(whatsappSettingsService.getUpdate).mockResolvedValue(NO_TEMPLATE);
    await expect(sendConv()).rejects.toMatchObject({
      statusCode: 409,
      code: "update_template_missing",
      message: "No General update template is set. Ask a manager to choose one in Integrations.",
    });
  });

  it("502 template_failed with the SendSeven reason when success is false", async () => {
    vi.mocked(whatsappTemplatesRepository.send).mockResolvedValue({ ...OK_TEMPLATE, success: false, error: "bad", error_details: "Param 4 invalid" });
    await expect(sendConv()).rejects.toMatchObject({
      statusCode: 502,
      code: "template_failed",
      message: "WhatsApp didn't accept the update: Param 4 invalid",
    });
    expect(messagesService.afterStaffSend).not.toHaveBeenCalled();
  });

  it("502 template_failed when SendSeven throws", async () => {
    vi.mocked(whatsappTemplatesRepository.send).mockRejectedValue(new AppError("template not found", 404));
    await expect(sendConv()).rejects.toMatchObject({ statusCode: 502, code: "template_failed", message: "WhatsApp didn't accept the update: template not found" });
  });

  it("429 on a repeated identical template send, but a failure does not arm the guard", async () => {
    const text = uniqueText();
    await sendConv(text);
    await expect(sendConv(text)).rejects.toMatchObject({ statusCode: 429, message: "This update was just sent" });

    const failing = uniqueText();
    vi.mocked(whatsappTemplatesRepository.send).mockResolvedValueOnce({ ...OK_TEMPLATE, success: false });
    await expect(sendConv(failing)).rejects.toMatchObject({ statusCode: 502 });
    await expect(sendConv(failing)).resolves.toMatchObject({ viaTemplate: true });
  });

  it("400s without an org in scope", async () => {
    await expect(sendConv(uniqueText(), scope({ orgId: null }))).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("sendToClient", () => {
  it("rejects a channel that is not an active verified WhatsApp channel", async () => {
    vi.mocked(channelsService.listChannels).mockResolvedValue([
      { id: "ch2", channel_type: "sms", is_active: true, is_verified: true },
      { id: "ch3", channel_type: "whatsapp", is_active: false, is_verified: true },
    ] as never);
    await expect(sendClient(uniqueText(), scope(), "ch2")).rejects.toMatchObject({ statusCode: 400 });
    await expect(sendClient(uniqueText(), scope(), "ch3")).rejects.toMatchObject({ statusCode: 400 });
    await expect(sendClient(uniqueText(), scope(), "missing")).rejects.toMatchObject({ statusCode: 400 });
  });

  it("propagates the error for an out-of-scope client", async () => {
    vi.mocked(neonClientService.getNeonClientById).mockRejectedValue(new AppError("Client not found", 404));
    await expect(sendClient()).rejects.toMatchObject({ statusCode: 404 });
    expect(whatsappTemplatesRepository.send).not.toHaveBeenCalled();
  });

  describe("unlinked client", () => {
    beforeEach(() => {
      vi.mocked(contactLinkService.getByClient).mockResolvedValue({ clientId: "c1", contactId: null, linkedAt: null });
    });

    it("409 update_template_missing without a template", async () => {
      vi.mocked(whatsappSettingsService.getUpdate).mockResolvedValue(NO_TEMPLATE);
      await expect(sendClient()).rejects.toMatchObject({ statusCode: 409, code: "update_template_missing" });
    });

    it("422 when the client has no usable phone number", async () => {
      vi.mocked(neonClientService.getNeonClientById).mockResolvedValue({ id: "c1", firstName: "Ann", phoneNumber: null } as never);
      await expect(sendClient()).rejects.toMatchObject({ statusCode: 422, message: "This client has no phone number to message on WhatsApp" });
      expect(whatsappTemplatesRepository.send).not.toHaveBeenCalled();
    });

    it("sends the template by whatsapp_id and best-effort links the client to the new contact", async () => {
      vi.mocked(conversationsService.getById).mockResolvedValue({ id: "conv9", contact_id: "knew" } as never);
      const r = await sendClient();
      expect(r).toEqual({ conversationId: "conv9", viaTemplate: true });
      const body = vi.mocked(whatsappTemplatesRepository.send).mock.calls[0][1];
      expect(body).toMatchObject({ whatsapp_id: "447123456789", channel_id: "ch1" });
      expect(body.contact_id).toBeUndefined();
      expect(contactLinkService.linkIfUnlinked).toHaveBeenCalledWith("knew", "c1", expect.objectContaining({ orgId: "o1" }));
      expect(messagesService.afterStaffSend).toHaveBeenCalledWith("o1", "conv9", "u1");
      expect(vi.mocked(whatsappTemplatesRepository.send).mock.calls[0][1].variable_values?.["1"]).toBe("Ann");
    });

    it("still succeeds when the auto-link fails", async () => {
      vi.mocked(conversationsService.getById).mockResolvedValue({ id: "conv9", contact_id: "knew" } as never);
      vi.mocked(contactLinkService.linkIfUnlinked).mockRejectedValue(new Error("db"));
      await expect(sendClient()).resolves.toEqual({ conversationId: "conv9", viaTemplate: true });
    });
  });

  describe("linked client", () => {
    it("open window and open conversation: free text", async () => {
      const r = await sendClient("hello there");
      expect(r).toEqual({ conversationId: "conv1", viaTemplate: false });
      expect(messagesService.send).toHaveBeenCalledWith("o1", { conversation_id: "conv1", channel_id: "ch1", message_type: "text", text: "hello there" }, "u1");
      expect(contactLinkService.linkIfUnlinked).not.toHaveBeenCalled();
    });

    it("open window, no conversation: opens one then sends free text", async () => {
      vi.mocked(conversationsService.checkExisting).mockResolvedValue({ has_existing_open: false, existing_open_conversation_id: null, window_status: { in_window: true } });
      vi.mocked(conversationsService.openOrCreate).mockResolvedValue({ conversation_id: "conv5", window_status: { in_window: true } });
      const r = await sendClient();
      expect(r).toEqual({ conversationId: "conv5", viaTemplate: false });
      expect(conversationsService.openOrCreate).toHaveBeenCalledWith({ contact_id: "k1", channel_id: "ch1", reopen_existing: true });
    });

    it("closed window with an open conversation: template to the conversation only", async () => {
      vi.mocked(conversationsService.checkExisting).mockResolvedValue({
        has_existing_open: true, existing_open_conversation_id: "conv1", window_status: { in_window: false },
      });
      const r = await sendClient();
      expect(r.viaTemplate).toBe(true);
      const body = vi.mocked(whatsappTemplatesRepository.send).mock.calls[0][1];
      expect(body.conversation_id).toBe("conv1");
      expect(body.contact_id).toBeUndefined();
      expect(contactLinkService.linkIfUnlinked).not.toHaveBeenCalled();
    });

    it("closed window with no open conversation: template to contact_id + whatsapp_id", async () => {
      vi.mocked(conversationsService.checkExisting).mockResolvedValue({ has_existing_open: false, existing_open_conversation_id: null, requires_template: true });
      await sendClient();
      expect(vi.mocked(whatsappTemplatesRepository.send).mock.calls[0][1]).toMatchObject({
        contact_id: "k1", conversation_id: null, whatsapp_id: "447123456789", channel_id: "ch1",
      });
    });

    it("window rejection on the free send falls back to the template", async () => {
      vi.mocked(messagesService.send).mockRejectedValue(new AppError("Outside the 24-hour messaging window", 400));
      expect((await sendClient()).viaTemplate).toBe(true);
    });

    it("409 when the window is closed and no template is set", async () => {
      vi.mocked(conversationsService.checkExisting).mockResolvedValue({ has_existing_open: true, existing_open_conversation_id: "conv1", requires_template: true });
      vi.mocked(whatsappSettingsService.getUpdate).mockResolvedValue(NO_TEMPLATE);
      await expect(sendClient()).rejects.toMatchObject({ statusCode: 409, code: "update_template_missing" });
    });

    it("429 on a repeated identical template send", async () => {
      vi.mocked(conversationsService.checkExisting).mockResolvedValue({ has_existing_open: true, existing_open_conversation_id: "conv1", requires_template: true });
      const text = uniqueText();
      await sendClient(text);
      await expect(sendClient(text)).rejects.toMatchObject({ statusCode: 429 });
    });
  });
});
