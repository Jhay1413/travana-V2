import { describe, it, expect } from "vitest";
import { signupSchema, resendVerificationSchema } from "./onboarding.validator";

function validBranch() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return {
    name: "Main Branch",
    address: "1 High St",
    phone: "0123456789",
    email: "branch@acme.com",
    openingPattern: "mon-fri",
    bankHolidaysOpen: false,
    openingHours: days.map((day) => ({ day, open: true, openTime: "09:00", closeTime: "17:00" })),
  };
}

function validSignupBody(overrides: Record<string, unknown> = {}) {
  return {
    agencyName: "Acme Travel",
    slug: "acme-travel",
    ownerName: "Ada Lovelace",
    ownerEmail: "ada@acme.com",
    ownerPhone: "0123456789",
    password: "supersecret",
    branches: [validBranch()],
    ...overrides,
  };
}

describe("signupSchema", () => {
  it("accepts a well-formed signup payload", () => {
    expect(signupSchema.safeParse({ body: validSignupBody() }).success).toBe(true);
  });

  it("requires homeworkerCommission when hasHomeworkers is on", () => {
    const result = signupSchema.safeParse({ body: validSignupBody({ hasHomeworkers: true }) });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("homeworkerCommission");
    }
  });

  it("accepts hasHomeworkers when the commission is supplied", () => {
    const result = signupSchema.safeParse({
      body: validSignupBody({ hasHomeworkers: true, homeworkerCommission: 50 }),
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty branches array", () => {
    expect(signupSchema.safeParse({ body: validSignupBody({ branches: [] }) }).success).toBe(false);
  });

  it("rejects a branch whose openingHours is not exactly 7 days", () => {
    const branch = validBranch();
    branch.openingHours = branch.openingHours.slice(0, 5);
    expect(signupSchema.safeParse({ body: validSignupBody({ branches: [branch] }) }).success).toBe(false);
  });

  it("rejects an invalid slug", () => {
    expect(signupSchema.safeParse({ body: validSignupBody({ slug: "Acme Travel!" }) }).success).toBe(false);
  });

  it("rejects a password shorter than 8 characters", () => {
    expect(signupSchema.safeParse({ body: validSignupBody({ password: "short" }) }).success).toBe(false);
  });
});

describe("resendVerificationSchema", () => {
  it("rejects a malformed email", () => {
    expect(resendVerificationSchema.safeParse({ body: { email: "not-an-email" } }).success).toBe(false);
  });
});
