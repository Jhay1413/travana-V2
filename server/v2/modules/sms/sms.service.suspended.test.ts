import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./sms.repository", () => ({
  smsRepository: {
    findClientById: vi.fn(),
    isOrgActive: vi.fn(),
    findActiveTemplatesByTrigger: vi.fn(),
    hasRecentAutoSend: vi.fn(),
    findOrgNameById: vi.fn(),
    findLatestActiveBookingForClient: vi.fn(),
    findLatestTokenedQuoteForClient: vi.fn(),
    createMessage: vi.fn(),
  },
}));
vi.mock("../platform-admin/platform-admin-credits.repository", () => ({
  platformAdminCreditsRepository: { consumeOneCredit: vi.fn(), attachMessageToCharge: vi.fn() },
  startOfMonthUtc: vi.fn(),
}));

import { fireAutoTriggerForClient } from "./sms.service";
import { smsRepository as repo } from "./sms.repository";
import { platformAdminCreditsRepository as credits } from "../platform-admin/platform-admin-credits.repository";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(repo.findClientById).mockResolvedValue({
    id: "c1", orgId: "o1", smsOptIn: true, phoneNumber: "07700900123", firstName: "Ann", surename: "Lee",
  } as never);
  vi.mocked(repo.findActiveTemplatesByTrigger).mockResolvedValue([
    { id: "t1", name: "t", category: "custom", body: "Hi", autoTrigger: "on_booking_create" },
  ] as never);
  // Stops any template that is reached, so no real send is ever attempted.
  vi.mocked(repo.hasRecentAutoSend).mockResolvedValue(true);
});

describe("automatic texts and suspended organisations", () => {
  it("an event trigger for a suspended organisation sends nothing and uses no credit", async () => {
    vi.mocked(repo.isOrgActive).mockResolvedValue(false);

    const out = await fireAutoTriggerForClient({
      clientId: "c1", autoTrigger: "on_booking_create", dedupeSince: new Date(),
    });

    expect(out).toEqual({ sent: 0, skipped: 1, failed: 0, suspended: true });
    expect(repo.isOrgActive).toHaveBeenCalledWith("o1");
    expect(repo.findActiveTemplatesByTrigger).not.toHaveBeenCalled();
    expect(credits.consumeOneCredit).not.toHaveBeenCalled();
    expect(repo.createMessage).not.toHaveBeenCalled();
  });

  it("the departure trigger is skipped the same way", async () => {
    vi.mocked(repo.isOrgActive).mockResolvedValue(false);

    const out = await fireAutoTriggerForClient({
      clientId: "c1", autoTrigger: "days_before_departure", dedupeSince: new Date(), bookingId: "bk1",
    });

    expect(out.suspended).toBe(true);
    expect(repo.findActiveTemplatesByTrigger).not.toHaveBeenCalled();
  });

  it("an active organisation carries on to its templates as before", async () => {
    vi.mocked(repo.isOrgActive).mockResolvedValue(true);

    const out = await fireAutoTriggerForClient({
      clientId: "c1", autoTrigger: "on_booking_create", dedupeSince: new Date(),
    });

    expect(repo.findActiveTemplatesByTrigger).toHaveBeenCalledWith("o1", "on_booking_create");
    expect(repo.hasRecentAutoSend).toHaveBeenCalledTimes(1);
    expect(out).toEqual({ sent: 0, skipped: 1, failed: 0 });
  });
});
