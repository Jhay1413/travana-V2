import { describe, it, expect } from "vitest";
import {
  createPassengerValidator,
  updatePassengerValidator,
  setLeadPassportValidator,
  passengerParamsValidator,
} from "./client-passenger.validator";

const CID = "6f1c2f0e-8c3a-4a39-9d1e-2f6c5b9f7a11";
const PID = "7f1c2f0e-8c3a-4a39-9d1e-2f6c5b9f7a12";

describe("createPassengerValidator", () => {
  const FULL = { title: "Mr", firstName: "A", surname: "B", dateOfBirth: "2000-01-31", passportNumber: "X1", passportExpiry: "2030-05-01" };
  it("accepts a full body", () => {
    expect(createPassengerValidator.safeParse({ params: { clientId: CID }, body: FULL }).success).toBe(true);
  });
  it.each(Object.keys(FULL))("requires %s (missing, blank, or null)", (key) => {
    const missing: Record<string, unknown> = { ...FULL };
    delete missing[key];
    expect(createPassengerValidator.safeParse({ params: { clientId: CID }, body: missing }).success).toBe(false);
    expect(createPassengerValidator.safeParse({ params: { clientId: CID }, body: { ...FULL, [key]: "  " } }).success).toBe(false);
    expect(createPassengerValidator.safeParse({ params: { clientId: CID }, body: { ...FULL, [key]: null } }).success).toBe(false);
  });
  it("rejects bad dates and over-long passport numbers", () => {
    const base = FULL;
    expect(createPassengerValidator.safeParse({ params: { clientId: CID }, body: { ...base, dateOfBirth: "31/01/2000" } }).success).toBe(false);
    expect(createPassengerValidator.safeParse({ params: { clientId: CID }, body: { ...base, passportExpiry: "2030-02-30" } }).success).toBe(false);
    expect(createPassengerValidator.safeParse({ params: { clientId: CID }, body: { ...base, passportNumber: "1".repeat(21) } }).success).toBe(false);
  });
  it("rejects a non-uuid client id", () => {
    expect(createPassengerValidator.safeParse({ params: { clientId: "nope" }, body: FULL }).success).toBe(false);
  });
});

describe("updatePassengerValidator", () => {
  it("accepts a partial body", () => {
    expect(updatePassengerValidator.safeParse({ params: { clientId: CID, passengerId: PID }, body: { passportNumber: null } }).success).toBe(true);
  });
  it("accepts clearing optional fields and an empty body (old records with gaps)", () => {
    const params = { clientId: CID, passengerId: PID };
    expect(updatePassengerValidator.safeParse({ params, body: { title: null, dateOfBirth: "", passportExpiry: null } }).success).toBe(true);
    expect(updatePassengerValidator.safeParse({ params, body: {} }).success).toBe(true);
  });
  it("rejects a blank first name", () => {
    expect(updatePassengerValidator.safeParse({ params: { clientId: CID, passengerId: PID }, body: { firstName: "" } }).success).toBe(false);
  });
  it("requires uuid params", () => {
    expect(updatePassengerValidator.safeParse({ params: { clientId: CID, passengerId: "lead" }, body: {} }).success).toBe(false);
    expect(passengerParamsValidator.safeParse({ params: { clientId: CID, passengerId: PID } }).success).toBe(true);
  });
});

describe("setLeadPassportValidator", () => {
  it("accepts values and nulls", () => {
    expect(setLeadPassportValidator.safeParse({ params: { clientId: CID }, body: { passportNumber: "A1", passportExpiry: "2030-01-01" } }).success).toBe(true);
    expect(setLeadPassportValidator.safeParse({ params: { clientId: CID }, body: { passportNumber: null, passportExpiry: null } }).success).toBe(true);
  });
  it("rejects a missing field", () => {
    expect(setLeadPassportValidator.safeParse({ params: { clientId: CID }, body: { passportNumber: "A1" } }).success).toBe(false);
  });
});
