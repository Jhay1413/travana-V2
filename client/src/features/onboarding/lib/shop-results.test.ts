import { describe, expect, it } from "vitest";
import { failureText, splitShopResults } from "./shop-results";

describe("splitShopResults", () => {
  it("separates saved rows, failures and manager invite problems", () => {
    const out = splitShopResults(
      ["r0", "r1", "r2"],
      [
        { index: 0, status: "created", branchId: "b", managerInvite: "sent" },
        { index: 1, status: "error", error: "Shop limit reached", code: "BRANCH_LIMIT_REACHED", managerInvite: "not_attempted" },
        { index: 2, status: "updated", managerInvite: "error", managerInviteError: "Seat limit" },
      ],
    );
    expect(out.saved).toEqual(["r0", "r2"]);
    expect(out.failures.r1).toEqual({ message: "Shop limit reached", planLimit: true });
    expect(out.managerWarnings).toEqual({ r2: "Seat limit" });
  });
  it("only treats the exact limit code as a plan limit and tracks sent manager invites", () => {
    const out = splitShopResults(
      ["a", "b"],
      [
        { index: 0, status: "error", error: "x", code: "SOME_LIMIT", managerInvite: "not_attempted" },
        { index: 1, status: "created", managerInvite: "sent" },
      ],
    );
    expect(out.failures.a?.planLimit).toBe(false);
    expect(out.managerInvitedRows).toEqual(["b"]);
  });
  it("adds the contact hint only for plan limits", () => {
    expect(failureText({ message: "Shop limit reached", planLimit: true })).toBe(
      "Shop limit reached Contact us to add more shops.",
    );
    expect(failureText({ message: "Bad", planLimit: false })).toBe("Bad");
  });
});
