import { describe, it, expect } from "vitest";
import { sendInviteSchema, acceptInviteSubmitSchema, inviteUserIdParams } from "./invite.validator";

describe("sendInviteSchema", () => {
  const valid = { email: "x@y.com", branchId: "11111111-1111-1111-1111-111111111111", orgRole: "agent" };

  it("accepts a valid invite", () => {
    expect(sendInviteSchema.safeParse({ body: valid }).success).toBe(true);
  });

  it("rejects a malformed email", () => {
    expect(sendInviteSchema.safeParse({ body: { ...valid, email: "nope" } }).success).toBe(false);
  });

  it("rejects a non-UUID branchId", () => {
    expect(sendInviteSchema.safeParse({ body: { ...valid, branchId: "abc" } }).success).toBe(false);
  });

  it("accepts a homeworker without a branchId", () => {
    expect(sendInviteSchema.safeParse({ body: { email: "x@y.com", orgRole: "homeworker" } }).success).toBe(true);
  });

  it("rejects an agent without a branchId", () => {
    expect(sendInviteSchema.safeParse({ body: { email: "x@y.com", orgRole: "agent" } }).success).toBe(false);
  });

  it("rejects an empty or over-precise profitSharePercent for a homeworker", () => {
    expect(sendInviteSchema.safeParse({ body: { email: "x@y.com", orgRole: "homeworker", profitSharePercent: "" } }).success).toBe(false);
    expect(sendInviteSchema.safeParse({ body: { email: "x@y.com", orgRole: "homeworker", profitSharePercent: "40.123" } }).success).toBe(false);
  });

  it("rejects a role outside the allowed set (e.g. org_admin)", () => {
    expect(sendInviteSchema.safeParse({ body: { ...valid, orgRole: "org_admin" } }).success).toBe(false);
  });
});

describe("acceptInviteSubmitSchema", () => {
  const valid = { token: "t", firstName: "Ada", lastName: "Lovelace", phoneNumber: "123", password: "supersecret" };

  it("accepts a complete submission", () => {
    expect(acceptInviteSubmitSchema.safeParse({ body: valid }).success).toBe(true);
  });

  it("rejects a password shorter than 8 characters", () => {
    expect(acceptInviteSubmitSchema.safeParse({ body: { ...valid, password: "short" } }).success).toBe(false);
  });

  it("rejects a missing first name", () => {
    expect(acceptInviteSubmitSchema.safeParse({ body: { ...valid, firstName: "" } }).success).toBe(false);
  });
});

describe("sendInviteSchema names and params", () => {
  const valid = { email: "x@y.com", branchId: "11111111-1111-1111-1111-111111111111", orgRole: "agent" };

  it("accepts optional first and last name on the branch arm and bounds them", () => {
    expect(sendInviteSchema.safeParse({ body: { ...valid, firstName: "Ada", lastName: "Lovelace" } }).success).toBe(true);
    expect(sendInviteSchema.safeParse({ body: { ...valid, firstName: "x".repeat(61) } }).success).toBe(false);
  });

  it("inviteUserIdParams takes a text id and rejects an empty one", () => {
    expect(inviteUserIdParams.safeParse({ params: { userId: "user_1" } }).success).toBe(true);
    expect(inviteUserIdParams.safeParse({ params: { userId: "" } }).success).toBe(false);
  });
});
