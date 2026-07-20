import { describe, expect, it } from "vitest";
import { clientTable } from "@shared/schema";
import { phoneDigitsCondition } from "./phone-search";

describe("phoneDigitsCondition", () => {
  it("returns a condition for a phone-like query, regardless of formatting", () => {
    expect(phoneDigitsCondition(clientTable.phoneNumber, "07968215588")).not.toBeNull();
    expect(phoneDigitsCondition(clientTable.phoneNumber, "07968 215588")).not.toBeNull();
    expect(phoneDigitsCondition(clientTable.phoneNumber, "+44 (0)7968-215-588")).not.toBeNull();
  });

  it("returns null when the query has too few digits to be a phone fragment", () => {
    expect(phoneDigitsCondition(clientTable.phoneNumber, "kimberly")).toBeNull();
    expect(phoneDigitsCondition(clientTable.phoneNumber, "07")).toBeNull();
    expect(phoneDigitsCondition(clientTable.phoneNumber, "1 High Street")).toBeNull();
    expect(phoneDigitsCondition(clientTable.phoneNumber, "")).toBeNull();
    expect(phoneDigitsCondition(clientTable.phoneNumber, null)).toBeNull();
  });
});
