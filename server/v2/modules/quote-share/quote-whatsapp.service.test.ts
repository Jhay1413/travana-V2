import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./quote-share.service", () => ({ quoteShareService: { verifyAccess: vi.fn() } }));
vi.mock("../neon-client/neon-client.service", () => ({ neonClientService: { getNeonClientById: vi.fn() } }));
vi.mock("../contact-link/contact-link.service", () => ({ contactLinkService: { getByClient: vi.fn() } }));
vi.mock("../channels/channels.service", () => ({ channelsService: { listChannels: vi.fn() } }));
vi.mock("../conversations/conversations.service", () => ({
  conversationsService: { checkExisting: vi.fn(), openOrCreate: vi.fn() },
}));
vi.mock("../messages/messages.service", () => ({ messagesService: { send: vi.fn() } }));
vi.mock("../../utils/sendseven", () => ({ isSendSevenConfigured: vi.fn() }));
vi.mock("../sms/sms.service", () => ({
  resolveQuoteToken: vi.fn(),
  buildPublicQuoteMessage: vi.fn(),
}));

import { quoteWhatsappService } from "./quote-whatsapp.service";
import { quoteShareService } from "./quote-share.service";
import { neonClientService } from "../neon-client/neon-client.service";
import { contactLinkService } from "../contact-link/contact-link.service";
import { channelsService } from "../channels/channels.service";
import { conversationsService } from "../conversations/conversations.service";
import { messagesService } from "../messages/messages.service";
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
    has_existing_open: true, existing_open_conversation_id: "conv1", window_status: { is_open: true },
  });
  vi.mocked(messagesService.send).mockResolvedValue({ status: "sent" } as never);
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
    vi.mocked(conversationsService.checkExisting).mockResolvedValue({ has_existing_open: false, window_status: { is_open: true } });
    vi.mocked(conversationsService.openOrCreate).mockResolvedValue({ conversation_id: "conv2", window_status: { is_open: true } });
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

  it("falls back no_contact when the client has no linked contact", async () => {
    vi.mocked(contactLinkService.getByClient).mockResolvedValue({ clientId: "c1", contactId: null, linkedAt: null });
    await expect(send()).resolves.toEqual({ status: "fallback", reason: "no_contact", ...MSG });
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
      has_existing_open: true, existing_open_conversation_id: "conv1", window_status: { is_open: false },
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
