import { describe, it, expect, vi, beforeEach } from "vitest";
import { branches } from "@shared/schema";

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return { ...actual, ne: vi.fn(actual.ne), eq: vi.fn(actual.eq) };
});

const whereMock = vi.fn();

vi.mock("../../config/database", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: whereMock,
      })),
    })),
  },
}));

import { branchRepository } from "./branch.repository";
import { eq, ne } from "drizzle-orm";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("branchRepository.countByOrg", () => {
  it("excludes homeworker branches and counts the remaining rows", async () => {
    whereMock.mockResolvedValue([{ id: "b1" }, { id: "b2" }]);

    const total = await branchRepository.countByOrg("o1");

    expect(total).toBe(2);
    expect(ne).toHaveBeenCalledWith(branches.branchType, "homeworker");
    expect(eq).toHaveBeenCalledWith(branches.organizationId, "o1");
  });
});

describe("branchRepository.findAllByOrg", () => {
  it("filters by branch type when one is given", async () => {
    const orderBy = vi.fn().mockResolvedValue([]);
    whereMock.mockReturnValue({ orderBy });

    await branchRepository.findAllByOrg("o1", "shop");

    expect(eq).toHaveBeenCalledWith(branches.branchType, "shop");
  });
});
