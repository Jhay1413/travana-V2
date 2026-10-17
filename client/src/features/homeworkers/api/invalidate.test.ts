import { describe, it, expect, vi } from "vitest";
import { invalidateHomeworkerData } from "./invalidate";
import { homeworkerKeys } from "./use-homeworker-queries";
import { branchKeys } from "@/features/organization/api/use-branch-queries";
import { organizationOverviewKeys } from "@/features/organization/api/use-organization-overview-queries";

describe("invalidateHomeworkerData", () => {
  it("invalidates homeworker, homeworker-branch and org overview queries", () => {
    const qc = { invalidateQueries: vi.fn() };
    invalidateHomeworkerData(qc);
    const keys = qc.invalidateQueries.mock.calls.map((c) => c[0].queryKey);
    expect(keys).toContainEqual(homeworkerKeys.all);
    expect(keys).toContainEqual(branchKeys.list("homeworker"));
    expect(keys).toContainEqual(organizationOverviewKeys.all);
  });
});
