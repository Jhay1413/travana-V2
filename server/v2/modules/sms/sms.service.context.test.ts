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
vi.mock("../../utils/public-url", () => ({ getPublicBaseUrl: () => "https://app.test" }));
vi.mock("../platform-admin/platform-admin-credits.repository", () => ({
  platformAdminCreditsRepository: { consumeOneCredit: vi.fn(), attachMessageToCharge: vi.fn() },
  startOfMonthUtc: vi.fn(),
}));

import { buildContextForClient, fireAutoTriggerForClient, sendSms, CONNEXA_TIMEOUT_MS } from "./sms.service";
import { smsRepository as repo } from "./sms.repository";

const client = { id: "c1", orgId: "o1", email: "a@b.com", firstName: "Ann", surename: "Lee" };
const july = { hays_ref: "JULY", supplier_ref: "S-JUL", travel_date: "2026-07-10", title: "Spain", sales_price: "1000", discounts: "200" };
const december = { hays_ref: "DEC", supplier_ref: "S-DEC", travel_date: "2026-12-10", title: "Austria", sales_price: "2000", discounts: "0" };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(repo.isOrgActive).mockResolvedValue(true);
});

describe("buildContextForClient and the booking it describes", () => {
  it("uses the named booking, not the client's latest one (client with a July and a December booking)", async () => {
    vi.mocked(repo.findActiveBookingForClient).mockResolvedValue(july as never);
    vi.mocked(repo.findLatestActiveBookingForClient).mockResolvedValue(december as never);

    const ctx = await buildContextForClient(client, { bookingId: "bk-july" });

    expect(repo.findActiveBookingForClient).toHaveBeenCalledWith("c1", "bk-july");
    expect(repo.findLatestActiveBookingForClient).not.toHaveBeenCalled();
    expect(ctx.hays_ref).toBe("JULY");
    expect(ctx.destination).toBe("Spain");
    expect(ctx.departure_date).toContain("2026");
    expect(ctx.balance_due).toBe("£800.00");
  });

  it("leaves the booking fields blank, not another trip's, when the named booking is gone", async () => {
    vi.mocked(repo.findActiveBookingForClient).mockResolvedValue(undefined);
    vi.mocked(repo.findLatestActiveBookingForClient).mockResolvedValue(december as never);

    const ctx = await buildContextForClient(client, { bookingId: "bk-gone" });

    expect(ctx.hays_ref).toBe("");
    expect(ctx.destination).toBe("");
    expect(repo.findLatestActiveBookingForClient).not.toHaveBeenCalled();
  });

  it("falls back to the latest active booking when no booking id is given (event triggers)", async () => {
    vi.mocked(repo.findLatestActiveBookingForClient).mockResolvedValue(december as never);

    const ctx = await buildContextForClient(client);

    expect(repo.findLatestActiveBookingForClient).toHaveBeenCalledWith("c1");
    expect(repo.findActiveBookingForClient).not.toHaveBeenCalled();
    expect(ctx.hays_ref).toBe("DEC");
  });

  it("the sweep passes its booking id through to the context", async () => {
    vi.mocked(repo.findClientById).mockResolvedValue({ ...client, smsOptIn: true, phoneNumber: "07700900123" } as never);
    vi.mocked(repo.findActiveTemplatesByTrigger).mockResolvedValue([{ id: "t1", name: "t", category: "custom", body: "Re {{hays_ref}}" }] as never);
    vi.mocked(repo.hasRecentAutoSend).mockResolvedValue(true); // stop before sending
    vi.mocked(repo.findActiveBookingForClient).mockResolvedValue(july as never);

    await fireAutoTriggerForClient({
      clientId: "c1", autoTrigger: "days_before_departure", bookingId: "bk-july", dedupeSince: new Date(),
    });

    expect(repo.findActiveBookingForClient).toHaveBeenCalledWith("c1", "bk-july");
    expect(repo.findLatestActiveBookingForClient).not.toHaveBeenCalled();
  });

  it("an event trigger without a booking id still uses the latest booking", async () => {
    vi.mocked(repo.findClientById).mockResolvedValue({ ...client, smsOptIn: true, phoneNumber: "07700900123" } as never);
    vi.mocked(repo.findActiveTemplatesByTrigger).mockResolvedValue([{ id: "t1", name: "t", category: "custom", body: "x" }] as never);
    vi.mocked(repo.hasRecentAutoSend).mockResolvedValue(true);
    vi.mocked(repo.findLatestActiveBookingForClient).mockResolvedValue(december as never);

    await fireAutoTriggerForClient({ clientId: "c1", autoTrigger: "on_booking_create", dedupeSince: new Date() });

    expect(repo.findLatestActiveBookingForClient).toHaveBeenCalledWith("c1");
    expect(repo.findActiveBookingForClient).not.toHaveBeenCalled();
  });
});

describe("sendSms timeout", () => {
  const original = { ...process.env };
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    // Fake values: the test never talks to Connexa, fetch is stubbed.
    process.env.CONNEXA_EMAIL = "fake@example.test";
    process.env.CONNEXA_PASSWORD = "fake-password";
  });
  afterEach(() => {
    process.env = { ...original };
    globalThis.fetch = realFetch;
  });

  it("gives both Connexa calls a timeout signal", async () => {
    const calls: Array<{ url: string; signal: AbortSignal | null | undefined }> = [];
    globalThis.fetch = vi.fn(async (url: unknown, init?: RequestInit) => {
      calls.push({ url: String(url), signal: init?.signal });
      const body = String(url).includes("issue-token")
        ? { access_token: "tok", expires_in: 1 }
        : { response: { data: { uuid: "sid-1" }, status: "accepted" } };
      return new Response(JSON.stringify(body), { status: 200 });
    }) as typeof fetch;

    await sendSms({ to: "+447700900123", body: "hi" });

    expect(CONNEXA_TIMEOUT_MS).toBeGreaterThan(0);
    expect(calls.length).toBeGreaterThanOrEqual(1);
    const send = calls.find((c) => c.url.includes("schedule-message"));
    expect(send?.signal).toBeInstanceOf(AbortSignal);
  });

  it("a stalled send rejects instead of hanging", async () => {
    globalThis.fetch = vi.fn(async (url: unknown) => {
      if (String(url).includes("issue-token")) return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 });
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    }) as typeof fetch;

    await expect(sendSms({ to: "+447700900123", body: "hi" })).rejects.toThrow(/timeout/i);
  });
});
