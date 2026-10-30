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
  it("accepts a minimal and a full body", () => {
    expect(createPassengerValidator.safeParse({ params: { clientId: CID }, body: { firstName: "A", surname: "B" } }).success).toBe(true);
    expect(
      createPassengerValidator.safeParse({
        params: { clientId: CID },
        body: { title: "Mr", firstName: "A", surname: "B", dateOfBirth: "2000-01-31", passportNumber: "X1", passportExpiry: "2030-05-01" },
      }).success,
    ).toBe(true);
  });
  it("accepts null and empty-string optionals", () => {
    expect(
      createPassengerValidator.safeParse({
        params: { clientId: CID },
        body: { title: null, firstName: "A", surname: "B", dateOfBirth: "", passportNumber: null, passportExpiry: "" },
      }).success,
    ).toBe(true);
  });
  it("rejects missing or blank names", () => {
    expect(createPassengerValidator.safeParse({ params: { clientId: CID }, body: { surname: "B" } }).success).toBe(false);
    expect(createPassengerValidator.safeParse({ params: { clientId: CID }, body: { firstName: "  ", surname: "B" } }).success).toBe(false);
  });
  it("rejects bad dates and over-long passport numbers", () => {
    const base = { firstName: "A", surname: "B" };
    expect(createPassengerValidator.safeParse({ params: { clientId: CID }, body: { ...base, dateOfBirth: "31/01/2000" } }).success).toBe(false);
    expect(createPassengerValidator.safeParse({ params: { clientId: CID }, body: { ...base, passportExpiry: "2030-02-30" } }).success).toBe(false);
    expect(createPassengerValidator.safeParse({ params: { clientId: CID }, body: { ...base, passportNumber: "1".repeat(21) } }).success).toBe(false);
  });
  it("rejects a non-uuid client id", () => {
    expect(createPassengerValidator.safeParse({ params: { clientId: "nope" }, body: { firstName: "A", surname: "B" } }).success).toBe(false);
  });
});

describe("updatePassengerValidator", () => {
  it("accepts a partial body", () => {
    expect(updatePassengerValidator.safeParse({ params: { clientId: CID, passengerId: PID }, body: { passportNumber: null } }).success).toBe(true);
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
