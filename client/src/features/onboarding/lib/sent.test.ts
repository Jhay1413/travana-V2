import { describe, expect, it } from "vitest";
import { addEmails, displayResults, inviteStanding, stillToInvite } from "./sent";
import { sentEmailsOf, type PlannedInvite } from "./invite-plan";
import { canRunOnboarding } from "./access";
import { defaultBranch, visibleBranches } from "./branches";
import type { OnboardingBranch } from "../types";

describe("sent emails", () => {
  it("dedupes and lower-cases", () => {
    expect(addEmails(["a@x.co"], ["A@X.co", "b@x.co", " "])).toEqual(["a@x.co", "b@x.co"]);
  });
  it("classifies sent, manager and fresh emails", () => {
    expect(inviteStanding("A@x.co", ["a@x.co"], [])).toBe("sent");
    expect(inviteStanding("m@x.co", [], ["m@x.co"])).toBe("manager");
    expect(inviteStanding("n@x.co", ["a@x.co"], ["m@x.co"])).toBeNull();
  });
  it("never re-sends handled rows", () => {
    const rows = [{ email: "a@x.co" }, { email: "M@x.co" }, { email: "n@x.co" }];
    expect(stillToInvite(rows, ["a@x.co"], ["m@x.co"])).toEqual([{ email: "n@x.co" }]);
  });
  it("shows persisted standing over live results, with the manager note", () => {
    const out = displayResults(
      [
        { id: "1", email: "a@x.co" },
        { id: "2", email: "m@x.co" },
        { id: "3", email: "n@x.co" },
        { id: "4", email: "o@x.co" },
      ],
      { "3": { status: "error", message: "Seats full" } },
      ["a@x.co"],
      ["m@x.co"],
    );
    expect(out["1"]).toEqual({ status: "sent", message: "Invited" });
    expect(out["2"]?.message).toBe("Already invited as shop manager");
    expect(out["3"]).toEqual({ status: "error", message: "Seats full" });
    expect(out["4"]).toBeUndefined();
  });
  it("collects the emails that were sent", () => {
    const planned = [
      { rowId: "1", email: "A@x.co" },
      { rowId: "2", email: "b@x.co" },
    ] as PlannedInvite[];
    expect(sentEmailsOf(planned, { "1": { status: "sent" }, "2": { status: "error" } })).toEqual(["a@x.co"]);
  });
});

const branch = (over: Partial<OnboardingBranch>): OnboardingBranch => ({
  id: "b",
  name: "B",
  phone: null,
  address: null,
  email: null,
  isDefault: false,
  isPlaceholder: false,
  ...over,
});

describe("branches and access", () => {
  it("hides only the placeholder branch", () => {
    const list = [
      branch({ id: "1", isDefault: true, isPlaceholder: true }),
      branch({ id: "2", isDefault: true }),
      branch({ id: "3" }),
    ];
    expect(visibleBranches(list).map((b) => b.id)).toEqual(["2", "3"]);
  });
  it("picks the default branch, else the first", () => {
    expect(defaultBranch([branch({ id: "1" }), branch({ id: "2", isDefault: true })])?.id).toBe("2");
    expect(defaultBranch([branch({ id: "1" })])?.id).toBe("1");
    expect(defaultBranch([])).toBeUndefined();
  });
  it("uses the primary role like the server", () => {
    expect(canRunOnboarding("org_admin")).toBe(true);
    expect(canRunOnboarding("branch_manager")).toBe(false);
    expect(canRunOnboarding(null)).toBe(false);
  });
});
