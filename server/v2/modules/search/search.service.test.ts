import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./search.repository", () => ({
  searchRepository: { globalSearch: vi.fn().mockResolvedValue({ clients: [], bookings: [], nextOffset: null }) },
}));

import { searchService } from "./search.service";
import { searchRepository } from "./search.repository";
import type { Scope } from "../../utils/scope";

const SCOPE: Scope = {
  orgId: "org1",
  branchId: "b1",
  orgRole: "agent",
  orgRoles: ["agent"],
  userId: "u1",
  branchType: "shop",
  ownsHomeworkerBranch: false,
};

beforeEach(() => vi.clearAllMocks());

describe("searchService.globalSearch", () => {
  it("passes the caller scope and org to the repository", async () => {
    await searchService.globalSearch("ada", SCOPE, 15, 0);
    expect(searchRepository.globalSearch).toHaveBeenCalledWith("ada", { orgId: "org1", scope: SCOPE, limit: 15, offset: 0 });
  });

  it("searches across orgs for platform_admin but still passes the scope", async () => {
    const admin = { ...SCOPE, orgRole: "platform_admin" as const, orgRoles: ["platform_admin" as const] };
    await searchService.globalSearch("ada", admin);
    expect(searchRepository.globalSearch).toHaveBeenCalledWith("ada", expect.objectContaining({ orgId: null, scope: admin }));
  });
});
