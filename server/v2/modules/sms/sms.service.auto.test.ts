import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./sms.repository", () => ({
  smsRepository: {
    findClientById: vi.fn(),
    isOrgActive: vi.fn(),
    findActiveTemplatesByTrigger: vi.fn(),
    isBookingFullyPaid: vi.fn(),
    hasRecentAutoSend: vi.fn(),
    findOrgNameById: vi.fn(),
    findLatestActiveBookingForClient: vi.fn(),
    findActiveBookingForClient: vi.fn(),
    findLatestTokenedQuoteForClient: vi.fn(),
    createMessage: vi.fn(),
  },
}));
vi.mock("../platform-admin/platform-admin-credits.repository", () => ({
  platformAdminCreditsRepository: { consumeOneCredit: vi.fn(), attachMessageToCharge: vi.fn() },
  startOfMonthUtc: vi.fn(),
}));
vi.mock("../../utils/public-url", () => ({ getPublicBaseUrl: () => "https://app.test" }));
const dispatcher = vi.hoisted(() => ({ fireAutoTrigger: vi.fn() }));
vi.mock("../customer-messaging/customer-messaging.service", () => ({ customerMessagingService: dispatcher }));

import { fireAutoTriggerForClient, isSmsConfigured, purposesFor, sendAutoSmsTemplates, sendTrackedSms } from "./sms.service";
import { smsRepository as repo } from "./sms.repository";
import { platformAdminCreditsRepository as credits } from "../platform-admin/platform-admin-credits.repository";

const fetchMock = vi.fn();
const SINCE = new Date("2026-11-24T00:00:00Z");

function tpl(over: Record<string, unknown> = {}) {
  return { id: "t1", name: "Confirm", category: "booking_confirmation", body: "Hi {{first_name}}", autoTrigger: "on_booking_create", triggerDaysBefore: null, ...over };
}
const okResponse = () => ({ ok: true, status: 200, json: async () => ({ response: { status: "accepted", data: { uuid: "msg-1" } } }) });
const tokenResponse = () => ({ ok: true, status: 200, json: async () => ({ access_token: "tok", expires_in: 3600 }) });

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  process.env.CONNEXA_EMAIL = "e2e@example.invalid";
  process.env.CONNEXA_PASSWORD = "not-a-real-password";
  delete process.env.CONNEXA_BASE_URL;
  vi.mocked(repo.findClientById).mockResolvedValue({ id: "c1", orgId: "o1", smsOptIn: true, phoneNumber: "07700900123", firstName: "Ann", surename: "Lee", email: "a@x.test" } as never);
  vi.mocked(repo.isOrgActive).mockResolvedValue(true);
  vi.mocked(repo.findActiveTemplatesByTrigger).mockResolvedValue([tpl()] as never);
  vi.mocked(repo.hasRecentAutoSend).mockResolvedValue(false);
  vi.mocked(repo.createMessage).mockResolvedValue({ id: "row-1" } as never);
  vi.mocked(credits.consumeOneCredit).mockResolvedValue({ enabled: true, overage: true, chargeId: "ch-1" } as never);
  fetchMock.mockImplementation(async (url: string) => (String(url).endsWith("/api/issue-token") ? tokenResponse() : okResponse()));
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.CONNEXA_EMAIL;
  delete process.env.CONNEXA_PASSWORD;
  delete process.env.CONNEXA_BASE_URL;
});

describe("the SMS branch keeps today's behaviour", () => {
  it("sends one text per active template with the merged body, logs a sent row and attaches the credit charge", async () => {
    const out = await sendAutoSmsTemplates({ clientId: "c1", autoTrigger: "on_booking_create", triggerSource: "booking.createBooking", dedupeSince: SINCE });
    expect(out).toMatchObject({ sent: 1, skipped: 0, failed: 0, templateName: "Confirm", providerMessageId: "msg-1" });
    expect(repo.createMessage).toHaveBeenCalledWith(expect.objectContaining({
      templateId: "t1", clientId: "c1", clientName: "Ann Lee", toPhone: "+447700900123", body: "Hi Ann", status: "sent",
      providerMessageId: "msg-1", triggeredBy: null, triggeredByName: "auto", triggerSource: "booking.createBooking",
    }));
    expect(credits.attachMessageToCharge).toHaveBeenCalledWith("ch-1", "row-1");
    const send = fetchMock.mock.calls.find((c) => String(c[0]).endsWith("/api/schedule-message"));
    expect(JSON.parse(send?.[1].body)).toMatchObject({ contact_number: "447700900123", message: "Hi Ann" });
  });

  it("the trigger source defaults to the trigger name", async () => {
    await sendAutoSmsTemplates({ clientId: "c1", autoTrigger: "on_booking_create" });
    expect(repo.createMessage).toHaveBeenCalledWith(expect.objectContaining({ triggerSource: "on_booking_create" }));
  });

  it("a failed provider call logs a failed row with the error, counts as failed, and still attaches the charge", async () => {
    fetchMock.mockImplementation(async (url: string) => (String(url).endsWith("/api/issue-token") ? tokenResponse() : { ok: false, status: 500, json: async () => ({ message: "provider down" }) }));
    const out = await sendAutoSmsTemplates({ clientId: "c1", autoTrigger: "on_booking_create" });
    expect(out).toMatchObject({ sent: 0, failed: 1, reason: "send_failed" });
    expect(repo.createMessage).toHaveBeenCalledWith(expect.objectContaining({ status: "failed", providerError: expect.stringContaining("provider down") }));
    expect(credits.attachMessageToCharge).toHaveBeenCalledWith("ch-1", "row-1");
  });

  it("opted-out client: skipped, nothing sent, no credit used", async () => {
    vi.mocked(repo.findClientById).mockResolvedValue({ id: "c1", orgId: "o1", smsOptIn: false, phoneNumber: "07700900123" } as never);
    const out = await sendAutoSmsTemplates({ clientId: "c1", autoTrigger: "on_booking_create" });
    expect(out).toEqual({ sent: 0, skipped: 1, failed: 0, reason: "opted_out" });
    expect(credits.consumeOneCredit).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("no phone: skipped", async () => {
    vi.mocked(repo.findClientById).mockResolvedValue({ id: "c1", orgId: "o1", smsOptIn: true, phoneNumber: " " } as never);
    expect(await sendAutoSmsTemplates({ clientId: "c1", autoTrigger: "on_booking_create" })).toEqual({ sent: 0, skipped: 1, failed: 0, reason: "no_phone" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("unknown client, or a client with no agency: nothing, no skip counted", async () => {
    vi.mocked(repo.findClientById).mockResolvedValue(undefined);
    expect(await sendAutoSmsTemplates({ clientId: "x", autoTrigger: "on_booking_create" })).toMatchObject({ sent: 0, skipped: 0, failed: 0 });
    vi.mocked(repo.findClientById).mockResolvedValue({ id: "c1", orgId: null, smsOptIn: true, phoneNumber: "07700900123" } as never);
    expect(await sendAutoSmsTemplates({ clientId: "c1", autoTrigger: "on_booking_create" })).toMatchObject({ sent: 0, skipped: 0, failed: 0 });
  });

  it("no active template for the trigger: nothing counted, reported as switched off", async () => {
    vi.mocked(repo.findActiveTemplatesByTrigger).mockResolvedValue([]);
    expect(await sendAutoSmsTemplates({ clientId: "c1", autoTrigger: "on_booking_create" })).toEqual({ sent: 0, skipped: 0, failed: 0, reason: "switched_off" });
  });

  it("duplicate within the window: skipped with no credit used", async () => {
    vi.mocked(repo.hasRecentAutoSend).mockResolvedValue(true);
    const out = await sendAutoSmsTemplates({ clientId: "c1", autoTrigger: "on_booking_create", dedupeSince: SINCE });
    expect(out).toEqual({ sent: 0, skipped: 1, failed: 0, reason: "duplicate" });
    expect(repo.hasRecentAutoSend).toHaveBeenCalledWith("t1", "c1", SINCE);
    expect(credits.consumeOneCredit).not.toHaveBeenCalled();
  });

  it("no dedupe window given: no duplicate check at all (as before)", async () => {
    await sendAutoSmsTemplates({ clientId: "c1", autoTrigger: "on_booking_create" });
    expect(repo.hasRecentAutoSend).not.toHaveBeenCalled();
  });

  it("a balance reminder for a fully paid booking is skipped before dedupe", async () => {
    vi.mocked(repo.findActiveTemplatesByTrigger).mockResolvedValue([tpl({ category: "balance_due", autoTrigger: "days_before_departure" })] as never);
    vi.mocked(repo.isBookingFullyPaid).mockResolvedValue(true);
    const out = await sendAutoSmsTemplates({ clientId: "c1", autoTrigger: "days_before_departure", bookingId: "bk1", dedupeSince: SINCE });
    expect(out).toEqual({ sent: 0, skipped: 1, failed: 0, reason: "fully_paid" });
    expect(repo.hasRecentAutoSend).not.toHaveBeenCalled();
  });

  it("each template is handled on its own: a duplicate one is skipped, the next is sent", async () => {
    vi.mocked(repo.findActiveTemplatesByTrigger).mockResolvedValue([tpl({ id: "a" }), tpl({ id: "b", name: "Second" })] as never);
    vi.mocked(repo.hasRecentAutoSend).mockImplementation(async (id: string) => id === "a");
    const out = await sendAutoSmsTemplates({ clientId: "c1", autoTrigger: "on_booking_create", dedupeSince: SINCE });
    expect(out).toMatchObject({ sent: 1, skipped: 1, failed: 0, templateName: "Second" });
    expect(out.reason).toBeUndefined();
  });

  it("never throws: an unexpected error is logged and the counts so far are returned", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(repo.findClientById).mockRejectedValue(new Error("db"));
    await expect(sendAutoSmsTemplates({ clientId: "c1", autoTrigger: "on_booking_create" })).resolves.toEqual({ sent: 0, skipped: 0, failed: 0 });
  });
});

describe("one message type's SMS rows (the purpose filter)", () => {
  const rows = [
    tpl({ id: "bal", category: "balance_due", autoTrigger: "days_before_departure", triggerDaysBefore: 14 }),
    tpl({ id: "dep", category: "custom", autoTrigger: "days_before_departure", triggerDaysBefore: 14 }),
  ];
  beforeEach(() => vi.mocked(repo.findActiveTemplatesByTrigger).mockResolvedValue(rows as never));

  it("a balance reminder fires only the balance_due row", async () => {
    await sendAutoSmsTemplates({ clientId: "c1", autoTrigger: "days_before_departure", purpose: "balance_reminder", dedupeSince: SINCE });
    expect(repo.hasRecentAutoSend).toHaveBeenCalledTimes(1);
    expect(repo.hasRecentAutoSend).toHaveBeenCalledWith("bal", "c1", SINCE);
  });

  it("a departure reminder fires every other row", async () => {
    await sendAutoSmsTemplates({ clientId: "c1", autoTrigger: "days_before_departure", purpose: "departure_reminder", dedupeSince: SINCE });
    expect(repo.hasRecentAutoSend).toHaveBeenCalledWith("dep", "c1", SINCE);
    expect(repo.hasRecentAutoSend).toHaveBeenCalledTimes(1);
  });

  it("without a purpose, both fire (the old behaviour)", async () => {
    await sendAutoSmsTemplates({ clientId: "c1", autoTrigger: "days_before_departure", dedupeSince: SINCE });
    expect(repo.hasRecentAutoSend).toHaveBeenCalledTimes(2);
  });

  it("the type mapping per trigger", () => {
    expect(purposesFor("on_booking_create")).toEqual(["booking_confirmation"]);
    expect(purposesFor("on_pin_set")).toEqual(["portal_ready"]);
    expect(purposesFor("days_before_departure")).toEqual(["balance_reminder", "departure_reminder"]);
  });
});

describe("fireAutoTriggerForClient (the entry point callers use)", () => {
  it("hands the whole request to the dispatcher and returns its counts", async () => {
    dispatcher.fireAutoTrigger.mockResolvedValue({ sent: 1, skipped: 2, failed: 0 });
    const opts = { clientId: "c1", autoTrigger: "on_pin_set" as const, triggerSource: "portal.staff.set-pin", dedupeSince: SINCE };
    expect(await fireAutoTriggerForClient(opts)).toEqual({ sent: 1, skipped: 2, failed: 0 });
    expect(dispatcher.fireAutoTrigger).toHaveBeenCalledWith(opts);
  });

  it("never throws into the booking or PIN flow", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    dispatcher.fireAutoTrigger.mockRejectedValue(new Error("boom"));
    await expect(fireAutoTriggerForClient({ clientId: "c1", autoTrigger: "on_booking_create" })).resolves.toEqual({ sent: 0, skipped: 0, failed: 0 });
  });
});

describe("sendTrackedSms and the provider address", () => {
  const input = { orgId: "o1", templateId: null, templateName: "Portal sign-in link", clientId: "c1", clientName: "Ann Lee", phone: "+447700900123", body: "hello", triggerSource: "portal.pin-reset" };

  it("defaults to the real provider address", async () => {
    await sendTrackedSms(input);
    // (the bearer token is cached per process, so the login call may not happen here)
    expect(fetchMock.mock.calls.every((c) => String(c[0]).startsWith("https://cnxa.io/api/"))).toBe(true);
  });

  it("CONNEXA_BASE_URL overrides the address (no trailing slash needed)", async () => {
    process.env.CONNEXA_BASE_URL = "http://127.0.0.1:5056/connexa/";
    // the bearer token is cached per process; a fresh login proves the base was used for whichever call is first
    await sendTrackedSms(input);
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.startsWith("http://127.0.0.1:5056/connexa/api/"))).toBe(true);
    expect(urls.every((u) => !u.startsWith("https://cnxa.io"))).toBe(true);
  });

  it("logs the row with the given trigger source and who triggered it", async () => {
    await sendTrackedSms({ ...input, triggeredBy: "u1", triggeredByName: "Sam" });
    expect(repo.createMessage).toHaveBeenCalledWith(expect.objectContaining({ triggeredBy: "u1", triggeredByName: "Sam", triggerSource: "portal.pin-reset", templateId: null, status: "sent" }));
  });

  it("reports a provider failure instead of throwing", async () => {
    fetchMock.mockImplementation(async (url: string) => (String(url).endsWith("/api/issue-token") ? tokenResponse() : { ok: false, status: 502, json: async () => ({}) }));
    expect(await sendTrackedSms(input)).toEqual({ ok: false, error: expect.stringContaining("Connexa send failed") });
  });

  it("isSmsConfigured needs both login values", () => {
    expect(isSmsConfigured()).toBe(true);
    delete process.env.CONNEXA_PASSWORD;
    expect(isSmsConfigured()).toBe(false);
  });
});

describe("stored text and links", () => {
  it("the logged body hides a live sign-in code, while the sent text keeps it", async () => {
    await sendTrackedSms({ orgId: "o1", templateId: null, templateName: "Portal sign-in link", clientId: "c1", clientName: "Ann Lee", phone: "+447700900123", body: "Tap https://p.test/portal/login?mt=SECRET123abc&next=%2Fportal%2Faccount", triggerSource: "portal.pin-reset" });
    const stored = vi.mocked(repo.createMessage).mock.calls[0][0] as { body: string };
    expect(stored.body).toBe("Tap https://p.test/portal/login?mt=[redacted]&next=%2Fportal%2Faccount");
    expect(stored.body).not.toContain("SECRET123abc");
    const send = fetchMock.mock.calls.find((c) => String(c[0]).endsWith("/api/schedule-message"));
    expect(JSON.parse(send?.[1].body).message).toContain("mt=SECRET123abc");
  });

  it("a failed send hides the code in its logged body too", async () => {
    fetchMock.mockImplementation(async (url: string) => (String(url).endsWith("/api/issue-token") ? tokenResponse() : { ok: false, status: 502, json: async () => ({}) }));
    await sendTrackedSms({ orgId: "o1", templateId: null, templateName: "x", clientId: "c1", clientName: "A", phone: "+447700900123", body: "https://p.test/portal/login?mt=SECRET", triggerSource: "t" });
    expect((vi.mocked(repo.createMessage).mock.calls[0][0] as { body: string }).body).toBe("https://p.test/portal/login?mt=[redacted]");
  });

  it("a message that promises a quote link is not sent with a blank one", async () => {
    vi.mocked(repo.findActiveTemplatesByTrigger).mockResolvedValue([tpl({ body: "Hi {{first_name}}, your quote: {{quote_url}}" })] as never);
    vi.mocked(repo.findLatestTokenedQuoteForClient).mockResolvedValue(undefined);
    const out = await sendAutoSmsTemplates({ clientId: "c1", autoTrigger: "on_booking_create" });
    expect(out).toEqual({ sent: 0, skipped: 1, failed: 0, reason: "no_quote_link" });
    expect(credits.consumeOneCredit).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("the same message is sent when the customer has a quote they can still open", async () => {
    vi.mocked(repo.findActiveTemplatesByTrigger).mockResolvedValue([tpl({ body: "Your quote: {{quote_url}}" })] as never);
    vi.mocked(repo.findLatestTokenedQuoteForClient).mockResolvedValue({ id: "q1", token: "tok" });
    const out = await sendAutoSmsTemplates({ clientId: "c1", autoTrigger: "on_booking_create" });
    expect(out.sent).toBe(1);
    const send = fetchMock.mock.calls.find((c) => String(c[0]).endsWith("/api/schedule-message"));
    expect(JSON.parse(send?.[1].body).message).toBe("Your quote: https://app.test/portal/quote/tok");
  });

  it("a message with no quote link placeholder is unaffected by there being no quote", async () => {
    vi.mocked(repo.findLatestTokenedQuoteForClient).mockResolvedValue(undefined);
    expect((await sendAutoSmsTemplates({ clientId: "c1", autoTrigger: "on_booking_create" })).sent).toBe(1);
  });
});

describe("the balance due date (a placeholder, not the operator's payment term)", () => {
  const booking = { hays_ref: "HAY-1", supplier_ref: "S", travel_date: "2026-12-10", title: "Spain", sales_price: "1000", discounts: "0", main_tour_operator_id: "op1" };

  it("is departure minus 14 days, in UK style, with no lookup of the booking's operator", async () => {
    vi.mocked(repo.findActiveTemplatesByTrigger).mockResolvedValue([tpl({ body: "Balance by {{balance_due_date}}; departs {{departure_date}}", autoTrigger: "days_before_departure", category: "balance_due" })] as never);
    vi.mocked(repo.findLatestActiveBookingForClient).mockResolvedValue(booking as never);
    await sendAutoSmsTemplates({ clientId: "c1", autoTrigger: "days_before_departure" });
    const send = fetchMock.mock.calls.find((c) => String(c[0]).endsWith("/api/schedule-message"));
    expect(JSON.parse(send?.[1].body).message).toBe("Balance by 26 Nov 2026; departs 10 Dec 2026");
    expect(Object.keys(repo)).not.toContain("findBalanceDueWeeks");
  });
});
