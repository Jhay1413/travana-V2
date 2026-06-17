import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./revenue.repository", () => ({
  revenueRepository: {
    getForwardsForMonth: vi.fn(),
    getBookingsForMonth: vi.fn(),
    getUpsellDetailsForCalendarMonth: vi.fn(),
  },
}));

import { revenueService } from "./revenue.service";
import { revenueRepository } from "./revenue.repository";

// platform_admin → orgId resolves to null (whole platform); repo is mocked anyway.
const SCOPE = { orgRole: "platform_admin", orgId: null } as never;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("revenueService.getMonthForwards", () => {
  it("computes avgDealValue and applies the default monthly target", async () => {
    vi.mocked(revenueRepository.getForwardsForMonth).mockResolvedValue({ totalCommission: 1000, dealCount: 4 } as never);

    const result = await revenueService.getMonthForwards(2026, 3, SCOPE);

    expect(result.forwards).toBe(1000);
    expect(result.deals).toBe(4);
    expect(result.avgDealValue).toBe(250); // 1000 / 4
    expect(result.target).toBe(12000); // DEFAULT_MONTHLY_TARGETS[3]
  });

  it("avoids divide-by-zero when there are no deals", async () => {
    vi.mocked(revenueRepository.getForwardsForMonth).mockResolvedValue({ totalCommission: 0, dealCount: 0 } as never);

    const result = await revenueService.getMonthForwards(2026, 1, SCOPE);

    expect(result.avgDealValue).toBe(0);
  });
});

describe("revenueService.getMonthBookings — mapping", () => {
  it("maps bookings and upsells into a single labelled list", async () => {
    vi.mocked(revenueRepository.getBookingsForMonth).mockResolvedValue([
      {
        bookingId: "b1",
        clientId: "c1",
        clientFirstName: "Ada",
        clientSurename: "Lovelace",
        title: "Maldives",
        travelDate: "2026-07-01",
        commission: "500",
        agentId: "a1",
        agentFirstName: "Grace",
        agentLastName: "Hopper",
      },
    ] as never);
    vi.mocked(revenueRepository.getUpsellDetailsForCalendarMonth).mockResolvedValue([
      {
        upsellId: "u1",
        bookingId: "b1",
        clientId: "c1",
        clientFirstName: "Ada",
        clientSurename: "Lovelace",
        upsellType: "LOUNGE",
        description: null,
        addedAt: "2026-07-02",
        commission: "20",
        agentId: "a1",
        agentFirstName: "Grace",
        agentLastName: "Hopper",
      },
    ] as never);

    const result = await revenueService.getMonthBookings(2026, 7, SCOPE);

    expect(result.bookings).toHaveLength(2);
    expect(result.bookings[0]).toMatchObject({ id: "b1", clientName: "Ada Lovelace", destination: "Maldives", isUpsell: false });
    // upsell falls back to the human label when it has no description
    expect(result.bookings[1]).toMatchObject({ id: "u1", isUpsell: true, upsellLabel: "Lounge Pass", destination: "Lounge Pass" });
  });
});
