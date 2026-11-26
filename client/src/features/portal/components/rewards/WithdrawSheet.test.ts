import { describe, it, expect } from "vitest";
import { BOOKING_CREDIT_WITHDRAWAL_ENABLED, METHODS } from "./WithdrawSheet";

describe("withdrawal methods", () => {
  it("offers bank transfer only while booking credit is switched off (the server cannot do it)", () => {
    expect(BOOKING_CREDIT_WITHDRAWAL_ENABLED).toBe(false);
    expect(METHODS.map((m) => m.value)).toEqual(["bank_transfer"]);
  });
});
