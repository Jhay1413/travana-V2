import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./organization-seat.repository", () => ({
  organizationSeatRepository: { countUsage: vi.fn() },
}));

import { organizationSeatService } from "./organization-seat.service";
import { organizationSeatRepository } from "./organization-seat.repository";

function usage(limit: number | null, activeMembers: number, pendingInvites: number) {
  vi.mocked(organizationSeatRepository.countUsage).mockResolvedValue({ limit, activeMembers, pendingInvites });
}

beforeEach(() => vi.clearAllMocks());

describe("organizationSeatService.getUsage", () => {
  it("adds active members and pending invites", async () => {
    usage(10, 6, 2);
    await expect(organizationSeatService.getUsage("o1")).resolves.toEqual({
      limit: 10, activeMembers: 6, pendingInvites: 2, used: 8, available: 2,
    });
  });

  it("never reports negative availability when over capacity", async () => {
    usage(5, 7, 1);
    const result = await organizationSeatService.getUsage("o1");
    expect(result.used).toBe(8);
    expect(result.available).toBe(0);
  });

  it("reports null limit and availability for an unlimited plan", async () => {
    usage(null, 40, 3);
    await expect(organizationSeatService.getUsage("o1")).resolves.toEqual({
      limit: null, activeMembers: 40, pendingInvites: 3, used: 43, available: null,
    });
  });
});

describe("organizationSeatService.assertSeatAvailable", () => {
  it("passes while a seat is free", async () => {
    usage(10, 6, 3);
    await expect(organizationSeatService.assertSeatAvailable("o1")).resolves.toBeUndefined();
  });

  it("409s with the seat count when members + pending invites fill the plan", async () => {
    usage(10, 7, 3);
    await expect(organizationSeatService.assertSeatAvailable("o1")).rejects.toMatchObject({
      statusCode: 409,
      message: "All 10 seats are in use",
    });
  });

  it("409s when over capacity", async () => {
    usage(5, 7, 1);
    await expect(organizationSeatService.assertSeatAvailable("o1")).rejects.toMatchObject({ statusCode: 409 });
  });

  it("never blocks an unlimited plan", async () => {
    usage(null, 500, 50);
    await expect(organizationSeatService.assertSeatAvailable("o1")).resolves.toBeUndefined();
  });
});
