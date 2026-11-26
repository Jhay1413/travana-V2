import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./customer-messaging.repository", () => {
  class LogUnavailableError extends Error {}
  return {
    LogUnavailableError,
    customerMessagingRepository: {
      findClient: vi.fn(),
      insertLog: vi.fn(),
      reserveSend: vi.fn(),
      finalizeLog: vi.fn(),
      listSwitchRows: vi.fn(),
      setSwitchActive: vi.fn(),
    },
  };
});
vi.mock("../organization/organization.repository", () => ({
  organizationRepository: { findById: vi.fn(), mergeSettingsSection: vi.fn() },
}));
vi.mock("./customer-messaging-whatsapp.service", () => ({
  sendAutoWhatsapp: vi.fn(),
  isSwitchedOn: vi.fn(),
  dedupeKeyFor: (i: { purpose: string; context: { bookingId?: string } }) => (i.context.bookingId ? `${i.purpose}:${i.context.bookingId}` : i.purpose),
}));
vi.mock("../sms/sms.service", async () => {
  const purposes = await import("./customer-messaging.purposes");
  return {
    sendAutoSmsTemplates: vi.fn(),
    sendTrackedSms: vi.fn(),
    isSmsConfigured: vi.fn(),
    purposesFor: (t: "on_booking_create" | "on_pin_set" | "days_before_departure") => purposes.purposesForTrigger(t),
  };
});

import { customerMessagingService, SettingsUnavailableError } from "./customer-messaging.service";
import { customerMessagingRepository as repo, LogUnavailableError } from "./customer-messaging.repository";
import { organizationRepository as orgRepo } from "../organization/organization.repository";
import { isSwitchedOn, sendAutoWhatsapp } from "./customer-messaging-whatsapp.service";
import { isSmsConfigured, sendAutoSmsTemplates, sendTrackedSms } from "../sms/sms.service";
import type { DispatchInput, SkipReason } from "./customer-messaging.types";

const wa = vi.mocked(sendAutoWhatsapp);
const sms = vi.mocked(sendAutoSmsTemplates);

const input = (over: Partial<DispatchInput> = {}): DispatchInput => ({
  orgId: "o1", clientId: "c1", purpose: "booking_confirmation", context: {}, triggerSource: "booking.create", ...over,
});
const client = { id: "c1", orgId: "o1", firstName: "A", surename: "B", email: null, phoneNumber: "1", smsOptIn: true, branchId: null, createdBy: null };
const orgWith = (settings: Record<string, unknown> | null) => vi.mocked(orgRepo.findById).mockResolvedValue({ id: "o1", settings } as never);

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(repo.findClient).mockResolvedValue(client);
  vi.mocked(repo.insertLog).mockResolvedValue(undefined);
  vi.mocked(repo.finalizeLog).mockResolvedValue(undefined);
  vi.mocked(repo.reserveSend).mockResolvedValue({ id: "res-sms" });
  vi.mocked(isSwitchedOn).mockResolvedValue(true);
  orgWith({});
  wa.mockResolvedValue({ status: "sent", templateName: "tpl", providerMessageId: "m1" });
  sms.mockResolvedValue({ sent: 1, skipped: 0, failed: 0, templateName: "T", providerMessageId: "s1" });
});

describe("the agency setting", () => {
  it("is WhatsApp when nothing is stored", async () => {
    orgWith({});
    expect(await customerMessagingService.getAutoChannel("o1")).toBe("whatsapp");
  });

  it("is WhatsApp when there is no settings object at all, or the org is missing", async () => {
    orgWith(null);
    expect(await customerMessagingService.getAutoChannel("o1")).toBe("whatsapp");
    vi.mocked(orgRepo.findById).mockResolvedValue(null);
    expect(await customerMessagingService.getAutoChannel("o1")).toBe("whatsapp");
  });

  it("is WhatsApp for an unknown stored value", async () => {
    orgWith({ messaging: { autoChannel: "carrier-pigeon" } });
    expect(await customerMessagingService.getAutoChannel("o1")).toBe("whatsapp");
  });

  it("a READ ERROR is not turned into a default: it throws SettingsUnavailableError", async () => {
    vi.mocked(orgRepo.findById).mockRejectedValue(new Error("db"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(customerMessagingService.getAutoChannel("o1")).rejects.toBeInstanceOf(SettingsUnavailableError);
  });

  it("is SMS when stored", async () => {
    orgWith({ messaging: { autoChannel: "sms" } });
    expect(await customerMessagingService.getAutoChannel("o1")).toBe("sms");
  });

  it("saves into the messaging section only (an atomic per-section merge)", async () => {
    expect(await customerMessagingService.setAutoChannel("o1", "sms")).toEqual({ autoChannel: "sms" });
    expect(orgRepo.mergeSettingsSection).toHaveBeenCalledWith("o1", "messaging", { autoChannel: "sms" });
  });
});

describe("dispatchCustomerMessage: channel choice and no fallback", () => {
  it("default setting sends by WhatsApp only: the SMS side is never touched", async () => {
    const r = await customerMessagingService.dispatchCustomerMessage(input());
    expect(r).toMatchObject({ status: "sent", channel: "whatsapp" });
    expect(wa).toHaveBeenCalledTimes(1);
    expect(sms).not.toHaveBeenCalled();
    expect(sendTrackedSms).not.toHaveBeenCalled();
  });

  it("the SMS setting sends by SMS only: WhatsApp is never touched", async () => {
    orgWith({ messaging: { autoChannel: "sms" } });
    const r = await customerMessagingService.dispatchCustomerMessage(input());
    expect(r).toMatchObject({ status: "sent", channel: "sms" });
    expect(sms).toHaveBeenCalledTimes(1);
    expect(wa).not.toHaveBeenCalled();
  });

  it("an explicit channel overrides the setting, both ways", async () => {
    orgWith({ messaging: { autoChannel: "sms" } });
    expect(await customerMessagingService.dispatchCustomerMessage(input({ channel: "whatsapp" }))).toMatchObject({ channel: "whatsapp" });
    expect(sms).not.toHaveBeenCalled();
    orgWith({});
    expect(await customerMessagingService.dispatchCustomerMessage(input({ channel: "sms" }))).toMatchObject({ channel: "sms" });
    expect(wa).toHaveBeenCalledTimes(1);
    expect(orgRepo.findById).not.toHaveBeenCalled(); // an explicit channel never reads the setting
  });

  it("every WhatsApp skip reason stays a skip: SMS is never tried instead", async () => {
    const reasons: SkipReason[] = ["org_suspended", "no_phone", "opted_out", "not_connected", "no_channel", "no_template", "duplicate", "homeworker", "log_unavailable", "send_failed"];
    for (const reason of reasons) {
      wa.mockResolvedValueOnce({ status: "skipped", reason });
      const r = await customerMessagingService.dispatchCustomerMessage(input());
      expect(r).toMatchObject({ status: "skipped", channel: "whatsapp", reason });
    }
    expect(sms).not.toHaveBeenCalled();
    expect(sendTrackedSms).not.toHaveBeenCalled();
  });

  it("every SMS skip reason stays a skip: WhatsApp is never tried instead", async () => {
    orgWith({ messaging: { autoChannel: "sms" } });
    const reasons: SkipReason[] = ["org_suspended", "no_phone", "opted_out", "duplicate", "fully_paid"];
    for (const reason of reasons) {
      sms.mockResolvedValueOnce({ sent: 0, skipped: 1, failed: 0, reason });
      expect(await customerMessagingService.dispatchCustomerMessage(input())).toMatchObject({ status: "skipped", channel: "sms", reason });
    }
    sms.mockResolvedValueOnce({ sent: 0, skipped: 0, failed: 1, reason: "send_failed" });
    expect(await customerMessagingService.dispatchCustomerMessage(input())).toMatchObject({ status: "skipped", reason: "send_failed", counts: { failed: 1 } });
    expect(wa).not.toHaveBeenCalled();
  });

  it("an SMS run that found no active row for the type is 'switched_off'", async () => {
    orgWith({ messaging: { autoChannel: "sms" } });
    sms.mockResolvedValue({ sent: 0, skipped: 0, failed: 0, reason: "switched_off" });
    expect(await customerMessagingService.dispatchCustomerMessage(input())).toMatchObject({ status: "skipped", reason: "switched_off" });
  });

  it("a client of another agency is skipped on SMS before any provider is reached", async () => {
    orgWith({ messaging: { autoChannel: "sms" } });
    vi.mocked(repo.findClient).mockResolvedValue({ ...client, orgId: "other" });
    expect(await customerMessagingService.dispatchCustomerMessage(input())).toMatchObject({ status: "skipped", reason: "client_not_found" });
    expect(sms).not.toHaveBeenCalled();
  });

  it("an unexpected throw is a skip (send_failed), never an exception into the caller", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    wa.mockRejectedValue(new Error("boom"));
    expect(await customerMessagingService.dispatchCustomerMessage(input())).toMatchObject({ status: "skipped", reason: "send_failed" });
    expect(sms).not.toHaveBeenCalled();
  });

  it("hands the SMS branch the trigger for the purpose, with the sweep's context", async () => {
    orgWith({ messaging: { autoChannel: "sms" } });
    const dedupeSince = new Date("2026-11-24T00:00:00Z");
    await customerMessagingService.dispatchCustomerMessage(
      input({ purpose: "balance_reminder", context: { bookingId: "bk1", triggerDaysBefore: 14, dedupeSince }, triggerSource: "cron.days_before_departure.14" }),
    );
    expect(sms).toHaveBeenCalledWith({
      clientId: "c1", autoTrigger: "days_before_departure", triggerSource: "cron.days_before_departure.14",
      dedupeSince, triggerDaysBefore: 14, bookingId: "bk1", purpose: "balance_reminder",
    });
  });
});

describe("dispatchCustomerMessage: every outcome is logged", () => {
  it("a sent WhatsApp message writes a sent row with template and provider id", async () => {
    await customerMessagingService.dispatchCustomerMessage(input({ actorId: "u9" }));
    expect(repo.insertLog).toHaveBeenCalledWith({
      orgId: "o1", clientId: "c1", purpose: "booking_confirmation", channel: "whatsapp", status: "sent", reason: null,
      templateName: "tpl", triggerSource: "booking.create", triggeredBy: "u9", providerMessageId: "m1", dedupeKey: "booking_confirmation",
    });
  });

  it("a skipped WhatsApp message writes a skipped row with the reason", async () => {
    wa.mockResolvedValue({ status: "skipped", reason: "no_template" });
    await customerMessagingService.dispatchCustomerMessage(input());
    expect(repo.insertLog).toHaveBeenCalledWith(expect.objectContaining({ channel: "whatsapp", status: "skipped", reason: "no_template", providerMessageId: null, triggeredBy: null }));
  });

  it("a sent SMS settles its reservation as sent, with template and provider id", async () => {
    orgWith({ messaging: { autoChannel: "sms" } });
    await customerMessagingService.dispatchCustomerMessage(input({ context: { bookingId: "bk1" } }));
    expect(repo.reserveSend).toHaveBeenCalledWith({ since: expect.any(Date), row: expect.objectContaining({ channel: "sms", status: "pending", dedupeKey: "booking_confirmation:bk1" }) });
    expect(repo.finalizeLog).toHaveBeenCalledWith("res-sms", { status: "sent", reason: null, templateName: "T", providerMessageId: "s1" });
    expect(repo.insertLog).not.toHaveBeenCalled();
  });

  it("a sent WhatsApp message settles the reservation the branch made", async () => {
    wa.mockResolvedValue({ status: "sent", templateName: "tpl", providerMessageId: "m1", reservationId: "res-wa" });
    await customerMessagingService.dispatchCustomerMessage(input());
    expect(repo.finalizeLog).toHaveBeenCalledWith("res-wa", { status: "sent", reason: null, templateName: "tpl", providerMessageId: "m1" });
    expect(repo.insertLog).not.toHaveBeenCalled();
  });

  it("a send that fails after being reserved is settled as skipped (send_failed), not left pending", async () => {
    wa.mockResolvedValue({ status: "skipped", reason: "send_failed", templateName: "tpl", reservationId: "res-wa" });
    await customerMessagingService.dispatchCustomerMessage(input());
    expect(repo.finalizeLog).toHaveBeenCalledWith("res-wa", { status: "skipped", reason: "send_failed", templateName: "tpl", providerMessageId: null });
  });

  it("when the channel setting cannot be read nothing is sent, on either channel, and the skip is logged", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(orgRepo.findById).mockRejectedValue(new Error("db"));
    const r = await customerMessagingService.dispatchCustomerMessage(input());
    expect(r).toMatchObject({ status: "skipped", channel: "unknown", reason: "settings_unavailable" });
    expect(wa).not.toHaveBeenCalled();
    expect(sms).not.toHaveBeenCalled();
    expect(repo.insertLog).toHaveBeenCalledWith(expect.objectContaining({ channel: "unknown", status: "skipped", reason: "settings_unavailable" }));
  });

  it("an explicit channel does not need the setting at all", async () => {
    vi.mocked(orgRepo.findById).mockRejectedValue(new Error("db"));
    expect(await customerMessagingService.dispatchCustomerMessage(input({ channel: "whatsapp" }))).toMatchObject({ status: "sent", channel: "whatsapp" });
  });

  it("a switched-off type is not logged (nothing was meant to go out)", async () => {
    wa.mockResolvedValue({ status: "skipped", reason: "switched_off" });
    await customerMessagingService.dispatchCustomerMessage(input());
    expect(repo.insertLog).not.toHaveBeenCalled();
  });

  it("a missing log table never blocks the result: WhatsApp reports its own skip, SMS still sends with its own duplicate check", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.mocked(repo.insertLog).mockRejectedValue(new Error("customer_message_log is not available"));
    wa.mockResolvedValue({ status: "skipped", reason: "log_unavailable" });
    expect(await customerMessagingService.dispatchCustomerMessage(input())).toMatchObject({ status: "skipped", reason: "log_unavailable" });
    orgWith({ messaging: { autoChannel: "sms" } });
    vi.mocked(repo.reserveSend).mockRejectedValue(new LogUnavailableError());
    const since = new Date("2026-11-24T00:00:00Z");
    expect(await customerMessagingService.dispatchCustomerMessage(input({ context: { bookingId: "bk1", dedupeSince: since } }))).toMatchObject({ status: "sent", channel: "sms" });
    // Without the log the old per-template check is kept, even for a booking confirmation.
    expect(sms).toHaveBeenLastCalledWith(expect.objectContaining({ dedupeSince: since }));
  });

  it("a failing settle never throws into the caller", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.mocked(repo.finalizeLog).mockRejectedValue(new Error("db"));
    orgWith({ messaging: { autoChannel: "sms" } });
    await expect(customerMessagingService.dispatchCustomerMessage(input())).resolves.toMatchObject({ status: "sent" });
  });
});

describe("fireAutoTrigger (booking created, PIN set, departure sweep)", () => {
  it("booking created dispatches the booking confirmation type", async () => {
    const out = await customerMessagingService.fireAutoTrigger({ clientId: "c1", autoTrigger: "on_booking_create", triggerSource: "booking.createBooking" });
    expect(out).toEqual({ sent: 1, skipped: 0, failed: 0 });
    expect(wa).toHaveBeenCalledWith(expect.objectContaining({ orgId: "o1", clientId: "c1", purpose: "booking_confirmation", triggerSource: "booking.createBooking" }));
  });

  it("PIN set dispatches portal ready", async () => {
    await customerMessagingService.fireAutoTrigger({ clientId: "c1", autoTrigger: "on_pin_set" });
    expect(wa).toHaveBeenCalledWith(expect.objectContaining({ purpose: "portal_ready", triggerSource: "on_pin_set" }));
  });

  it("the departure sweep dispatches both reminder types with its context, and adds up the counts", async () => {
    const dedupeSince = new Date("2026-11-24T00:00:00Z");
    wa.mockResolvedValueOnce({ status: "sent", templateName: "a", providerMessageId: null }).mockResolvedValueOnce({ status: "skipped", reason: "no_template" });
    const out = await customerMessagingService.fireAutoTrigger({
      clientId: "c1", autoTrigger: "days_before_departure", bookingId: "bk1", triggerDaysBefore: 7, dedupeSince, triggerSource: "cron.days_before_departure.7",
    });
    expect(out).toEqual({ sent: 1, skipped: 1, failed: 0 });
    expect(wa.mock.calls.map((c) => c[0].purpose)).toEqual(["balance_reminder", "departure_reminder"]);
    expect(wa.mock.calls[0][0].context).toEqual({ bookingId: "bk1", triggerDaysBefore: 7, dedupeSince });
  });

  it("a suspended agency stops after the first type and is flagged, like the old behaviour", async () => {
    wa.mockResolvedValue({ status: "skipped", reason: "org_suspended" });
    const out = await customerMessagingService.fireAutoTrigger({ clientId: "c1", autoTrigger: "days_before_departure" });
    expect(out).toEqual({ sent: 0, skipped: 1, failed: 0, suspended: true });
    expect(wa).toHaveBeenCalledTimes(1);
  });

  it("an unknown client or a client with no agency sends nothing and does not throw", async () => {
    vi.mocked(repo.findClient).mockResolvedValue(null);
    expect(await customerMessagingService.fireAutoTrigger({ clientId: "x", autoTrigger: "on_booking_create" })).toEqual({ sent: 0, skipped: 0, failed: 0 });
    vi.mocked(repo.findClient).mockResolvedValue({ ...client, orgId: null });
    expect(await customerMessagingService.fireAutoTrigger({ clientId: "c1", autoTrigger: "on_booking_create" })).toEqual({ sent: 0, skipped: 0, failed: 0 });
    expect(wa).not.toHaveBeenCalled();
  });

  it("never throws into the booking or PIN flow, even when the lookup fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(repo.findClient).mockRejectedValue(new Error("db down"));
    await expect(customerMessagingService.fireAutoTrigger({ clientId: "c1", autoTrigger: "on_booking_create" })).resolves.toEqual({ sent: 0, skipped: 0, failed: 0 });
  });
});

describe("sendSignInLinkBySms (Forgotten your PIN? on the SMS setting)", () => {
  const args = (reserve: () => Promise<string | null>) => ({ orgId: "o1", clientId: "c1", firstName: "Ann", lastName: "Lee", orgName: "Tina Travel", phone: "+447700900123", reserve });

  it("skips before reserving anything when SMS is not configured (no link is minted)", async () => {
    vi.mocked(isSmsConfigured).mockReturnValue(false);
    const reserve = vi.fn();
    expect(await customerMessagingService.sendSignInLinkBySms(args(reserve))).toEqual({ status: "skipped", reason: "not_configured" });
    expect(reserve).not.toHaveBeenCalled();
    expect(sendTrackedSms).not.toHaveBeenCalled();
  });

  it("skips when a cap is reached, sending nothing", async () => {
    vi.mocked(isSmsConfigured).mockReturnValue(true);
    expect(await customerMessagingService.sendSignInLinkBySms(args(async () => null))).toEqual({ status: "skipped", reason: "capped" });
    expect(sendTrackedSms).not.toHaveBeenCalled();
  });

  it("texts the link to the phone on file, with no opt-out check at all", async () => {
    vi.mocked(isSmsConfigured).mockReturnValue(true);
    vi.mocked(sendTrackedSms).mockResolvedValue({ ok: true, providerMessageId: "s1" });
    const out = await customerMessagingService.sendSignInLinkBySms(args(async () => "https://p/portal/login?mt=abc"));
    expect(out).toEqual({ status: "sent" });
    expect(sendTrackedSms).toHaveBeenCalledWith(expect.objectContaining({
      orgId: "o1", clientId: "c1", phone: "+447700900123", templateId: null, triggerSource: "portal.pin-reset",
      body: expect.stringContaining("https://p/portal/login?mt=abc"),
    }));
    expect(repo.findClient).not.toHaveBeenCalled(); // opt-out lives on the client record, and is never read here
  });

  it("reports a provider failure as send_failed", async () => {
    vi.mocked(isSmsConfigured).mockReturnValue(true);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.mocked(sendTrackedSms).mockResolvedValue({ ok: false, error: "nope" });
    expect(await customerMessagingService.sendSignInLinkBySms(args(async () => "L"))).toEqual({ status: "skipped", reason: "send_failed" });
  });
});

describe("SMS: reserve first, so a channel switch inside the window cannot send twice", () => {
  beforeEach(() => orgWith({ messaging: { autoChannel: "sms" } }));

  it("a recent send of the same message on the OTHER channel is a duplicate: the SMS provider is never reached", async () => {
    vi.mocked(repo.reserveSend).mockResolvedValue(null); // the log holds a sent/pending WhatsApp row for this purpose and key
    const r = await customerMessagingService.dispatchCustomerMessage(input());
    expect(r).toMatchObject({ status: "skipped", channel: "sms", reason: "duplicate" });
    expect(sms).not.toHaveBeenCalled();
    expect(repo.insertLog).toHaveBeenCalledWith(expect.objectContaining({ channel: "sms", status: "skipped", reason: "duplicate" }));
  });

  it("a booking confirmation for a booking leaves the template-level text check out (two bookings both get theirs)", async () => {
    const since = new Date("2026-11-24T00:00:00Z");
    await customerMessagingService.dispatchCustomerMessage(input({ context: { bookingId: "bk1", dedupeSince: since } }));
    expect(sms).toHaveBeenCalledWith(expect.objectContaining({ bookingId: "bk1", dedupeSince: undefined }));
  });

  it("other types keep the text check as well as the log (sweep: once a day)", async () => {
    const since = new Date("2026-11-24T00:00:00Z");
    await customerMessagingService.dispatchCustomerMessage(input({ purpose: "departure_reminder", context: { bookingId: "bk1", dedupeSince: since } }));
    expect(sms).toHaveBeenCalledWith(expect.objectContaining({ dedupeSince: since }));
  });

  it("a type that is switched off never reserves, queries the client or logs", async () => {
    vi.mocked(isSwitchedOn).mockResolvedValue(false);
    expect(await customerMessagingService.dispatchCustomerMessage(input())).toMatchObject({ status: "skipped", reason: "switched_off" });
    expect(repo.findClient).not.toHaveBeenCalled();
    expect(repo.reserveSend).not.toHaveBeenCalled();
    expect(repo.insertLog).not.toHaveBeenCalled();
    expect(repo.finalizeLog).not.toHaveBeenCalled();
  });
});

describe("fireAutoTrigger passes the booking through", () => {
  it("the booking that fired the trigger reaches the dispatcher context, so the key and context are about that booking", async () => {
    await customerMessagingService.fireAutoTrigger({ clientId: "c1", autoTrigger: "on_booking_create", bookingId: "bk-new" });
    expect(wa).toHaveBeenCalledWith(expect.objectContaining({ context: expect.objectContaining({ bookingId: "bk-new" }) }));
  });
});

describe("the on/off switch of a message type", () => {
  const row = (over: Record<string, unknown>) => ({ id: "r", active: true, autoTrigger: "on_booking_create", category: "booking_confirmation", triggerDaysBefore: null, ...over });

  it("changes only the agency's own rows that belong to the type", async () => {
    vi.mocked(repo.listSwitchRows).mockResolvedValue([
      row({ id: "bal", autoTrigger: "days_before_departure", category: "balance_due", active: false }),
      row({ id: "dep", autoTrigger: "days_before_departure", category: "custom" }),
      row({ id: "book" }),
    ]);
    vi.mocked(repo.setSwitchActive).mockResolvedValue(1);
    expect(await customerMessagingService.setSwitch("o1", "balance_reminder", true)).toEqual({ purpose: "balance_reminder", active: true, rows: 1 });
    expect(repo.listSwitchRows).toHaveBeenCalledWith("o1");
    expect(repo.setSwitchActive).toHaveBeenCalledWith("o1", ["bal"], true);
  });

  it("a type with no text message yet cannot be switched on: a clear 409, nothing written", async () => {
    vi.mocked(repo.listSwitchRows).mockResolvedValue([row({})]);
    await expect(customerMessagingService.setSwitch("o1", "portal_ready", true)).rejects.toMatchObject({ statusCode: 409 });
    expect(repo.setSwitchActive).not.toHaveBeenCalled();
  });
});
