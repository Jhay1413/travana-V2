import { describe, expect, it } from "vitest";
import { customerActionDetail, customerActionLabel, isPositiveCustomerAction } from "./customer-actions";

describe("customerActionLabel", () => {
  it("words every kind of action, and passes an unknown one through", () => {
    expect(customerActionLabel("accepted")).toBe("Accepted the quote");
    expect(customerActionLabel("changes_requested")).toBe("Asked for changes");
    expect(customerActionLabel("declined")).toBe("Not interested");
    expect(customerActionLabel("reopened")).toBe("Changed their mind");
    expect(customerActionLabel("other")).toBe("other");
  });
});

describe("customerActionDetail", () => {
  it("a decline shows its reason and the something-similar flag", () => {
    expect(customerActionDetail({ actionType: "declined", reason: "Too expensive", wantsSimilar: true })).toBe("Reason: Too expensive · Wants something similar");
    expect(customerActionDetail({ actionType: "declined", reason: "Wrong dates", wantsSimilar: false })).toBe("Reason: Wrong dates");
  });

  it("a decline with no reason says so", () => {
    expect(customerActionDetail({ actionType: "declined", reason: null, wantsSimilar: true })).toBe("No reason given · Wants something similar");
  });

  it("other actions have no detail line", () => {
    expect(customerActionDetail({ actionType: "accepted" })).toBe("");
    expect(customerActionDetail({ actionType: "changes_requested", message: "x" })).toBe("");
  });
});

describe("isPositiveCustomerAction", () => {
  it("accepted and reopened are positive", () => {
    expect(isPositiveCustomerAction("accepted")).toBe(true);
    expect(isPositiveCustomerAction("reopened")).toBe(true);
    expect(isPositiveCustomerAction("declined")).toBe(false);
    expect(isPositiveCustomerAction("changes_requested")).toBe(false);
  });
});
