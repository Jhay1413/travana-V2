import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./sms.repository", () => ({
  smsRepository: {
    findClientById: vi.fn(),
    findActiveTemplatesByTrigger: vi.fn(),
    isBookingFullyPaid: vi.fn(),
    hasRecentAutoSend: vi.fn(),
    findOrgNameById: vi.fn(),
    findLatestActiveBookingForClient: vi.fn(),
    findLatestTokenedQuoteForClient: vi.fn(),
  },
}));
vi.mock("../platform-admin/platform-admin-credits.repository", () => ({
  platformAdminCreditsRepository: { consumeOneCredit: vi.fn(), attachMessageToCharge: vi.fn() },
  startOfMonthUtc: vi.fn(),
}));

import { fireAutoTriggerForClient } from "./sms.service";
import { smsRepository as repo } from "./sms.repository";

const SINCE = new Date("2026-10-20T00:00:00Z");

function template(id: string, category: string) {
  return { id, name: id, category, body: "Hi", autoTrigger: "days_before_departure" };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(repo.findClientById).mockResolvedValue({
    id: "c1", orgId: "o1", smsOptIn: true, phoneNumber: "07700900123", firstName: "Ann", surename: "Lee",
  } as never);
  // Every template that gets past the paid check is stopped by dedupe, so nothing is ever sent.
  vi.mocked(repo.hasRecentAutoSend).mockResolvedValue(true);
});

describe("days_before_departure sweep and fully-paid bookings", () => {
  it("skips a balance_due template when the booking is fully paid, without reaching dedupe", async () => {
    vi.mocked(repo.findActiveTemplatesByTrigger).mockResolvedValue([template("t1", "balance_due")] as never);
    vi.mocked(repo.isBookingFullyPaid).mockResolvedValue(true);

    const out = await fireAutoTriggerForClient({
      clientId: "c1", autoTrigger: "days_before_departure", dedupeSince: SINCE, bookingId: "bk1",
    });

    expect(out).toEqual({ sent: 0, skipped: 1, failed: 0 });
    expect(repo.isBookingFullyPaid).toHaveBeenCalledWith("bk1");
    expect(repo.hasRecentAutoSend).not.toHaveBeenCalled();
  });

  it("keeps a balance_due template when the booking is not fully paid", async () => {
    vi.mocked(repo.findActiveTemplatesByTrigger).mockResolvedValue([template("t1", "balance_due")] as never);
    vi.mocked(repo.isBookingFullyPaid).mockResolvedValue(false);

    await fireAutoTriggerForClient({ clientId: "c1", autoTrigger: "days_before_departure", dedupeSince: SINCE, bookingId: "bk1" });

    expect(repo.hasRecentAutoSend).toHaveBeenCalledWith("t1", "c1", SINCE);
  });

  it("never applies to other categories, which are not even checked", async () => {
    vi.mocked(repo.findActiveTemplatesByTrigger).mockResolvedValue([
      template("t1", "tickets_ready"), template("t2", "custom"),
    ] as never);
    vi.mocked(repo.isBookingFullyPaid).mockResolvedValue(true);

    await fireAutoTriggerForClient({ clientId: "c1", autoTrigger: "days_before_departure", dedupeSince: SINCE, bookingId: "bk1" });

    expect(repo.isBookingFullyPaid).not.toHaveBeenCalled();
    expect(repo.hasRecentAutoSend).toHaveBeenCalledTimes(2);
  });

  it("skips only the balance_due template in a mixed set, looking the booking up once", async () => {
    vi.mocked(repo.findActiveTemplatesByTrigger).mockResolvedValue([
      template("t1", "balance_due"), template("t2", "custom"), template("t3", "balance_due"),
    ] as never);
    vi.mocked(repo.isBookingFullyPaid).mockResolvedValue(true);

    const out = await fireAutoTriggerForClient({
      clientId: "c1", autoTrigger: "days_before_departure", dedupeSince: SINCE, bookingId: "bk1",
    });

    expect(out.skipped).toBe(3);
    expect(repo.isBookingFullyPaid).toHaveBeenCalledTimes(1);
    expect(repo.hasRecentAutoSend).toHaveBeenCalledTimes(1);
    expect(repo.hasRecentAutoSend).toHaveBeenCalledWith("t2", "c1", SINCE);
  });

  it("ignores payment when no booking id is given or for other triggers", async () => {
    vi.mocked(repo.findActiveTemplatesByTrigger).mockResolvedValue([template("t1", "balance_due")] as never);
    vi.mocked(repo.isBookingFullyPaid).mockResolvedValue(true);

    await fireAutoTriggerForClient({ clientId: "c1", autoTrigger: "days_before_departure", dedupeSince: SINCE });
    await fireAutoTriggerForClient({ clientId: "c1", autoTrigger: "on_booking_create", dedupeSince: SINCE, bookingId: "bk1" });

    expect(repo.isBookingFullyPaid).not.toHaveBeenCalled();
  });
});
