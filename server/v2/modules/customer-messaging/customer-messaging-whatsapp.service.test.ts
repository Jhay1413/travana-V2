import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./customer-messaging.repository", () => {
  class LogUnavailableError extends Error {}
  return {
    LogUnavailableError,
    customerMessagingRepository: {
      findClient: vi.fn(),
      isOrgActive: vi.fn(),
      listActiveSwitchRows: vi.fn(),
      findBookingOwner: vi.fn(),
      hasHomeworkerOwner: vi.fn(),
      hasRecentSent: vi.fn(),
      reserveSend: vi.fn(),
    },
  };
});
vi.mock("../sms/sms.repository", () => ({ smsRepository: { isBookingFullyPaid: vi.fn() } }));
vi.mock("../sms/sms.service", () => ({
  normalisePhone: (raw: string | null | undefined) => {
    if (!raw) return null;
    const p = raw.replace(/[^\d+]/g, "");
    if (!p) return null;
    if (p.startsWith("+")) return p;
    if (p.startsWith("0")) return `+44${p.slice(1)}`;
    return `+44${p}`;
  },
  buildContextForClient: vi.fn(),
  sendSms: vi.fn(),
  sendTrackedSms: vi.fn(),
}));
vi.mock("../whatsapp-templates/whatsapp-settings.service", () => ({ whatsappSettingsService: { getPurposeTemplates: vi.fn() } }));
vi.mock("../conversation-integration/conversation-integration.service", () => ({ conversationIntegrationService: { resolveConfig: vi.fn() } }));
vi.mock("../channels/channels.service", () => ({ channelsService: { listChannels: vi.fn() } }));
vi.mock("../usage/usage.service", () => ({ usageService: { recordSendsevenSend: vi.fn() } }));
vi.mock("../whatsapp-templates/whatsapp-templates.repository", () => ({ whatsappTemplatesRepository: { send: vi.fn() } }));
vi.mock("../organization/organization.repository", () => ({ organizationRepository: { findById: vi.fn() } }));
vi.mock("../user/user.repository", () => ({ userRepository: { findById: vi.fn() } }));
vi.mock("../contact-link/contact-link.service", () => ({ contactLinkService: {} }));
vi.mock("../conversations/conversations.service", () => ({ conversationsService: {} }));

import { sendAutoWhatsapp, isHandledByHomeworker } from "./customer-messaging-whatsapp.service";
import { customerMessagingRepository as repo, LogUnavailableError } from "./customer-messaging.repository";
import { smsRepository } from "../sms/sms.repository";
import { buildContextForClient, sendSms, sendTrackedSms } from "../sms/sms.service";
import { whatsappSettingsService } from "../whatsapp-templates/whatsapp-settings.service";
import { conversationIntegrationService } from "../conversation-integration/conversation-integration.service";
import { channelsService } from "../channels/channels.service";
import { whatsappTemplatesRepository } from "../whatsapp-templates/whatsapp-templates.repository";
import { organizationRepository } from "../organization/organization.repository";
import { AppError } from "../../utils/error-handler";
import type { DispatchInput } from "./customer-messaging.types";

const input = (over: Partial<DispatchInput> = {}): DispatchInput => ({
  orgId: "o1",
  clientId: "c1",
  purpose: "booking_confirmation",
  context: {},
  triggerSource: "test",
  ...over,
});

const sendTpl = vi.mocked(whatsappTemplatesRepository.send);

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(repo.findClient).mockResolvedValue({
    id: "c1", orgId: "o1", firstName: "Ann", surename: "Lee", email: "a@x.test", phoneNumber: "07700900123", smsOptIn: true, branchId: "b1", createdBy: "u1",
  });
  vi.mocked(repo.isOrgActive).mockResolvedValue(true);
  vi.mocked(repo.hasHomeworkerOwner).mockResolvedValue(false);
  vi.mocked(repo.listActiveSwitchRows).mockResolvedValue([{ autoTrigger: "on_booking_create", category: "booking_confirmation", triggerDaysBefore: null }]);
  vi.mocked(repo.hasRecentSent).mockResolvedValue(false);
  vi.mocked(repo.reserveSend).mockResolvedValue({ id: "res-1" });
  vi.mocked(whatsappSettingsService.getPurposeTemplates).mockResolvedValue({
    booking_confirmation: { templateName: "booking_ok", language: "en_GB", channelId: "ch1", variables: { "1": { source: "client_first_name" }, "2": { source: "destination" } } },
  });
  vi.mocked(conversationIntegrationService.resolveConfig).mockResolvedValue({ baseUrl: "http://x", token: "t" });
  vi.mocked(channelsService.listChannels).mockResolvedValue([{ id: "ch1", channel_type: "whatsapp", is_active: true, is_verified: true }]);
  vi.mocked(buildContextForClient).mockResolvedValue({ destination: "Rome", hays_ref: "HAY-1234567", departure_date: "1 Jun 2027", portal_link: "https://p/portal/login", balance_due_date: "18 May 2027" });
  sendTpl.mockResolvedValue({ success: true, message_id: "m1", external_id: null, conversation_id: "conv1", error: null, error_code: null, error_details: null });
  vi.mocked(organizationRepository.findById).mockResolvedValue({ name: "Tina Travel" } as never);
});

function expectNothingSent() {
  expect(sendTpl).not.toHaveBeenCalled();
  expect(sendSms).not.toHaveBeenCalled();
  expect(sendTrackedSms).not.toHaveBeenCalled();
}

describe("sendAutoWhatsapp: the happy path", () => {
  it("sends exactly one template, to the phone on file, with the variables resolved, and never an SMS", async () => {
    const out = await sendAutoWhatsapp(input());

    expect(out).toEqual({ status: "sent", templateName: "booking_ok", providerMessageId: "m1", reservationId: "res-1" });
    expect(sendTpl).toHaveBeenCalledTimes(1);
    expect(sendTpl).toHaveBeenCalledWith("booking_ok", {
      whatsapp_id: "447700900123",
      channel_id: "ch1",
      language: "en_GB",
      variable_values: { "1": "Ann", "2": "Rome" },
    });
    expect(sendSms).not.toHaveBeenCalled();
    expect(sendTrackedSms).not.toHaveBeenCalled();
  });

  it("never names a contact or conversation: the number on file is the only recipient", async () => {
    await sendAutoWhatsapp(input());
    const body = sendTpl.mock.calls[0][1];
    expect(body).not.toHaveProperty("contact_id");
    expect(body).not.toHaveProperty("conversation_id");
  });

  it("fills departure, reference and portal link from the booking context for a reminder", async () => {
    vi.mocked(repo.listActiveSwitchRows).mockResolvedValue([{ autoTrigger: "days_before_departure", category: "custom", triggerDaysBefore: 7 }]);
    vi.mocked(whatsappSettingsService.getPurposeTemplates).mockResolvedValue({
      departure_reminder: { templateName: "dep", language: "en", channelId: null, variables: { "1": { source: "booking_reference" }, "2": { source: "departure_date" }, "3": { source: "portal_link" } } },
    });
    await sendAutoWhatsapp(input({ purpose: "departure_reminder", context: { bookingId: "bk1", triggerDaysBefore: 7 } }));
    expect(sendTpl.mock.calls[0][1].variable_values).toEqual({ "1": "HAY-1234567", "2": "1 Jun 2027", "3": "https://p/portal/login" });
    expect(buildContextForClient).toHaveBeenCalledWith(expect.anything(), { bookingId: "bk1" });
  });

  it("gives blank booking fields a plain fallback (Meta rejects empty parameters)", async () => {
    vi.mocked(buildContextForClient).mockResolvedValue({ destination: "", portal_link: "https://p/portal/login" });
    await sendAutoWhatsapp(input());
    expect(sendTpl.mock.calls[0][1].variable_values).toEqual({ "1": "Ann", "2": "your holiday" });
  });
});

describe("sendAutoWhatsapp: every reason it sends nothing", () => {
  it("client_not_found: unknown client", async () => {
    vi.mocked(repo.findClient).mockResolvedValue(null);
    expect(await sendAutoWhatsapp(input())).toEqual({ status: "skipped", reason: "client_not_found" });
    expectNothingSent();
  });

  it("client_not_found: a client of another agency is never reached", async () => {
    vi.mocked(repo.findClient).mockResolvedValue({ ...(await repo.findClient("x"))!, orgId: "other-org" });
    expect(await sendAutoWhatsapp(input())).toEqual({ status: "skipped", reason: "client_not_found" });
    expectNothingSent();
  });

  it("org_suspended", async () => {
    vi.mocked(repo.isOrgActive).mockResolvedValue(false);
    expect(await sendAutoWhatsapp(input())).toMatchObject({ status: "skipped", reason: "org_suspended" });
    expectNothingSent();
  });

  it("opted_out: the customer's opt-out flag stops WhatsApp too", async () => {
    vi.mocked(repo.findClient).mockResolvedValue({ ...(await repo.findClient("x"))!, smsOptIn: false });
    expect(await sendAutoWhatsapp(input())).toMatchObject({ status: "skipped", reason: "opted_out" });
    expectNothingSent();
  });

  it("no_phone", async () => {
    vi.mocked(repo.findClient).mockResolvedValue({ ...(await repo.findClient("x"))!, phoneNumber: "  " });
    expect(await sendAutoWhatsapp(input())).toMatchObject({ status: "skipped", reason: "no_phone" });
    expectNothingSent();
  });

  it("homeworker: skipped for a client handled by a homeworker", async () => {
    vi.mocked(repo.hasHomeworkerOwner).mockResolvedValue(true);
    expect(await sendAutoWhatsapp(input())).toMatchObject({ status: "skipped", reason: "homeworker" });
    expectNothingSent();
  });

  it("switched_off: no active SMS row for the message type", async () => {
    vi.mocked(repo.listActiveSwitchRows).mockResolvedValue([{ autoTrigger: "on_pin_set", category: "custom", triggerDaysBefore: null }]);
    expect(await sendAutoWhatsapp(input())).toMatchObject({ status: "skipped", reason: "switched_off" });
    expectNothingSent();
  });

  it("switched_off: a row for another days-before value does not switch this sweep on", async () => {
    vi.mocked(repo.listActiveSwitchRows).mockResolvedValue([{ autoTrigger: "days_before_departure", category: "custom", triggerDaysBefore: 14 }]);
    const out = await sendAutoWhatsapp(input({ purpose: "departure_reminder", context: { triggerDaysBefore: 7 } }));
    expect(out).toMatchObject({ status: "skipped", reason: "switched_off" });
  });

  it("fully_paid: a balance reminder for a paid booking", async () => {
    vi.mocked(repo.listActiveSwitchRows).mockResolvedValue([{ autoTrigger: "days_before_departure", category: "balance_due", triggerDaysBefore: 14 }]);
    vi.mocked(smsRepository.isBookingFullyPaid).mockResolvedValue(true);
    const out = await sendAutoWhatsapp(input({ purpose: "balance_reminder", context: { bookingId: "bk1", triggerDaysBefore: 14 } }));
    expect(out).toMatchObject({ status: "skipped", reason: "fully_paid" });
    expectNothingSent();
  });

  it("duplicate: already sent inside the window", async () => {
    const since = new Date("2026-11-24T00:00:00Z");
    vi.mocked(repo.hasRecentSent).mockResolvedValue(true);
    expect(await sendAutoWhatsapp(input({ context: { dedupeSince: since } }))).toMatchObject({ status: "skipped", reason: "duplicate" });
    expect(repo.hasRecentSent).toHaveBeenCalledWith({ orgId: "o1", clientId: "c1", purpose: "booking_confirmation", dedupeKey: "booking_confirmation", since });
    expectNothingSent();
  });

  it("duplicate guard keys the sweep by booking and uses a 5 minute window when none is given", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-24T12:00:00Z"));
    try {
      vi.mocked(repo.listActiveSwitchRows).mockResolvedValue([{ autoTrigger: "days_before_departure", category: "custom", triggerDaysBefore: null }]);
      await sendAutoWhatsapp(input({ purpose: "departure_reminder", context: { bookingId: "bk1" } }));
      expect(repo.hasRecentSent).toHaveBeenCalledWith(expect.objectContaining({ dedupeKey: "departure_reminder:bk1", since: new Date("2026-11-24T11:55:00Z") }));
    } finally {
      vi.useRealTimers();
    }
  });

  it("log_unavailable: with no log table nothing is sent", async () => {
    vi.mocked(repo.hasRecentSent).mockRejectedValue(new LogUnavailableError());
    expect(await sendAutoWhatsapp(input())).toEqual({ status: "skipped", reason: "log_unavailable" });
    expectNothingSent();
  });

  it("no_template: none chosen for this message type", async () => {
    vi.mocked(whatsappSettingsService.getPurposeTemplates).mockResolvedValue({});
    expect(await sendAutoWhatsapp(input())).toEqual({ status: "skipped", reason: "no_template" });
    expect(conversationIntegrationService.resolveConfig).not.toHaveBeenCalled();
    expectNothingSent();
  });

  it("no_template: a cleared template (name null)", async () => {
    vi.mocked(whatsappSettingsService.getPurposeTemplates).mockResolvedValue({ booking_confirmation: { templateName: null, language: null, channelId: null, variables: {} } });
    expect(await sendAutoWhatsapp(input())).toMatchObject({ reason: "no_template" });
  });

  it("not_connected: the agency has no SendSeven workspace (never another tenant's)", async () => {
    vi.mocked(conversationIntegrationService.resolveConfig).mockResolvedValue(null);
    expect(await sendAutoWhatsapp(input())).toMatchObject({ status: "skipped", reason: "not_connected" });
    expect(channelsService.listChannels).not.toHaveBeenCalled();
    expectNothingSent();
  });

  it("not_connected: the channel list cannot be fetched", async () => {
    vi.mocked(channelsService.listChannels).mockRejectedValue(new AppError("down", 502));
    expect(await sendAutoWhatsapp(input())).toMatchObject({ status: "skipped", reason: "not_connected" });
    expectNothingSent();
  });

  it("no_channel: no active verified WhatsApp channel", async () => {
    vi.mocked(channelsService.listChannels).mockResolvedValue([{ id: "ig", channel_type: "instagram", is_active: true, is_verified: true }]);
    expect(await sendAutoWhatsapp(input())).toMatchObject({ status: "skipped", reason: "no_channel" });
    expectNothingSent();
  });

  it("send_failed: the provider rejects the template", async () => {
    sendTpl.mockResolvedValue({ success: false, message_id: null, external_id: null, conversation_id: "", error: "bad", error_code: 1, error_details: "nope" });
    expect(await sendAutoWhatsapp(input())).toMatchObject({ status: "skipped", reason: "send_failed" });
    expect(sendSms).not.toHaveBeenCalled();
  });

  it("send_failed: the provider call throws, and nothing falls back to SMS", async () => {
    sendTpl.mockRejectedValue(new AppError("Failed to reach the SendSeven service", 502));
    expect(await sendAutoWhatsapp(input())).toMatchObject({ status: "skipped", reason: "send_failed" });
    expect(sendSms).not.toHaveBeenCalled();
    expect(sendTrackedSms).not.toHaveBeenCalled();
  });

  it("send_failed: a template mapped to the portal link when no link exists", async () => {
    vi.mocked(buildContextForClient).mockResolvedValue({ portal_link: "" });
    vi.mocked(whatsappSettingsService.getPurposeTemplates).mockResolvedValue({
      booking_confirmation: { templateName: "t", language: "en", channelId: null, variables: { "1": { source: "portal_link" } } },
    });
    expect(await sendAutoWhatsapp(input())).toMatchObject({ reason: "send_failed" });
    expect(sendTpl).not.toHaveBeenCalled();
  });
});

describe("isHandledByHomeworker (the rule)", () => {
  const client = { id: "c1", orgId: "o1", firstName: "A", surename: "B", email: null, phoneNumber: "1", smsOptIn: true, branchId: "b1", createdBy: "u1" };

  it("tests the client's branch and creator", async () => {
    await isHandledByHomeworker(client, "o1");
    expect(repo.hasHomeworkerOwner).toHaveBeenCalledWith({ orgId: "o1", branchIds: ["b1"], userIds: ["u1"] });
    expect(repo.findBookingOwner).not.toHaveBeenCalled();
  });

  it("adds the booking's deal branch and agent when the send names a booking", async () => {
    vi.mocked(repo.findBookingOwner).mockResolvedValue({ userId: "u2", branchId: "b2" });
    await isHandledByHomeworker(client, "o1", "bk1");
    expect(repo.findBookingOwner).toHaveBeenCalledWith("c1", "bk1");
    expect(repo.hasHomeworkerOwner).toHaveBeenCalledWith({ orgId: "o1", branchIds: ["b1", "b2"], userIds: ["u1", "u2"] });
  });

  it("copes with a client that has no branch or creator", async () => {
    await isHandledByHomeworker({ ...client, branchId: null, createdBy: null }, "o1");
    expect(repo.hasHomeworkerOwner).toHaveBeenCalledWith({ orgId: "o1", branchIds: [], userIds: [] });
  });
});

describe("sendAutoWhatsapp: reserve before sending (the duplicate race)", () => {
  it("reserves the send in the log, on the whatsapp channel with the booking-specific key, before the provider is called", async () => {
    const order: string[] = [];
    vi.mocked(repo.reserveSend).mockImplementation(async () => { order.push("reserve"); return { id: "res-1" }; });
    sendTpl.mockImplementation(async () => { order.push("send"); return { success: true, message_id: "m1", external_id: null, conversation_id: "c", error: null, error_code: null, error_details: null }; });
    const since = new Date("2026-11-24T00:00:00Z");
    await sendAutoWhatsapp(input({ context: { bookingId: "bk1", dedupeSince: since } }));
    expect(order).toEqual(["reserve", "send"]);
    expect(repo.reserveSend).toHaveBeenCalledWith({
      since,
      row: expect.objectContaining({ orgId: "o1", clientId: "c1", purpose: "booking_confirmation", channel: "whatsapp", status: "pending", templateName: "booking_ok", dedupeKey: "booking_confirmation:bk1" }),
    });
  });

  it("a second request that loses the race is a duplicate and sends nothing", async () => {
    vi.mocked(repo.reserveSend).mockResolvedValue(null);
    expect(await sendAutoWhatsapp(input())).toEqual({ status: "skipped", reason: "duplicate", templateName: "booking_ok" });
    expectNothingSent();
  });

  it("without the log table the reservation fails closed: nothing is sent", async () => {
    vi.mocked(repo.reserveSend).mockRejectedValue(new LogUnavailableError());
    expect(await sendAutoWhatsapp(input())).toMatchObject({ status: "skipped", reason: "log_unavailable" });
    expectNothingSent();
  });

  it("a failed send hands the reservation back so the row can be settled as skipped", async () => {
    sendTpl.mockResolvedValue({ success: false, message_id: null, external_id: null, conversation_id: "", error: "x", error_code: 1, error_details: "nope" });
    expect(await sendAutoWhatsapp(input())).toMatchObject({ status: "skipped", reason: "send_failed", reservationId: "res-1" });
  });

  it("nothing is reserved when a skip happens earlier (no template, not connected, opted out ...)", async () => {
    vi.mocked(whatsappSettingsService.getPurposeTemplates).mockResolvedValue({});
    await sendAutoWhatsapp(input());
    vi.mocked(conversationIntegrationService.resolveConfig).mockResolvedValue(null);
    vi.mocked(whatsappSettingsService.getPurposeTemplates).mockResolvedValue({ booking_confirmation: { templateName: "t", language: "en", channelId: null, variables: {} } });
    await sendAutoWhatsapp(input());
    expect(repo.reserveSend).not.toHaveBeenCalled();
  });

  it("the on/off switch is checked first: a switched-off agency costs no client, org or log query", async () => {
    vi.mocked(repo.listActiveSwitchRows).mockResolvedValue([]);
    expect(await sendAutoWhatsapp(input())).toEqual({ status: "skipped", reason: "switched_off" });
    expect(repo.findClient).not.toHaveBeenCalled();
    expect(repo.isOrgActive).not.toHaveBeenCalled();
    expect(repo.hasRecentSent).not.toHaveBeenCalled();
    expect(repo.reserveSend).not.toHaveBeenCalled();
  });
});
