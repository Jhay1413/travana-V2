import { describe, it, expect } from "vitest";
import { availabilityValidator, logValidator, staffSendValidator } from "./customer-messaging-staff.validator";

const ID = "11111111-1111-4111-8111-111111111111";
const QUOTE = "22222222-2222-4222-8222-222222222222";

describe("availabilityValidator", () => {
  it("accepts a client id and either purpose", () => {
    for (const purpose of ["quote_link", "portal_sign_in"]) expect(availabilityValidator.safeParse({ query: { clientId: ID, purpose } }).success).toBe(true);
  });
  it("rejects a bad id, a missing purpose and an automatic purpose", () => {
    expect(availabilityValidator.safeParse({ query: { clientId: "x", purpose: "quote_link" } }).success).toBe(false);
    expect(availabilityValidator.safeParse({ query: { clientId: ID } }).success).toBe(false);
    expect(availabilityValidator.safeParse({ query: { clientId: ID, purpose: "balance_reminder" } }).success).toBe(false);
  });
});

describe("staffSendValidator", () => {
  it("accepts a quote link with a quote id on either channel", () => {
    for (const channel of ["whatsapp", "sms"]) expect(staffSendValidator.safeParse({ body: { clientId: ID, purpose: "quote_link", channel, quoteId: QUOTE } }).success).toBe(true);
  });
  it("requires a quote id for a quote link but not for the sign-in link", () => {
    const missing = staffSendValidator.safeParse({ body: { clientId: ID, purpose: "quote_link", channel: "sms" } });
    expect(missing.success).toBe(false);
    expect(staffSendValidator.safeParse({ body: { clientId: ID, purpose: "portal_sign_in", channel: "sms" } }).success).toBe(true);
  });
  it("rejects an unknown channel, an unknown purpose and extra keys", () => {
    expect(staffSendValidator.safeParse({ body: { clientId: ID, purpose: "portal_sign_in", channel: "email" } }).success).toBe(false);
    expect(staffSendValidator.safeParse({ body: { clientId: ID, purpose: "booking_confirmation", channel: "sms" } }).success).toBe(false);
    expect(staffSendValidator.safeParse({ body: { clientId: ID, purpose: "portal_sign_in", channel: "sms", phone: "07700900123" } }).success).toBe(false);
  });
});

describe("logValidator", () => {
  it("accepts a client id alone, or with a limit and a numeric cursor", () => {
    expect(logValidator.safeParse({ query: { clientId: ID } }).success).toBe(true);
    expect(logValidator.safeParse({ query: { clientId: ID, limit: "5", cursor: "20" } }).success).toBe(true);
  });
  it("rejects a limit out of range and a cursor that is not a number", () => {
    expect(logValidator.safeParse({ query: { clientId: ID, limit: "0" } }).success).toBe(false);
    expect(logValidator.safeParse({ query: { clientId: ID, limit: "51" } }).success).toBe(false);
    expect(logValidator.safeParse({ query: { clientId: ID, cursor: "abc" } }).success).toBe(false);
    expect(logValidator.safeParse({ query: { limit: "5" } }).success).toBe(false);
  });
});
