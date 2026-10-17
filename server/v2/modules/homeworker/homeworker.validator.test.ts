import { describe, it, expect } from "vitest";
import {
  createHomeworkerSchema,
  finaliseStatementSchema,
  myStatementQuerySchema,
  statementQuerySchema,
  homeworkerBranchParamsSchema,
  listHomeworkersSchema,
  profitSharePercentSchema,
  updateHomeworkerSchema,
} from "./homeworker.validator";
import { sendInviteSchema } from "../invite/invite.validator";
import { inviteEmployeeBodySchema } from "../hr/hr.validator";

const BRANCH_ID = "3f1c6d2e-8a4b-4c1d-9e2f-1a2b3c4d5e6f";

describe("profitSharePercentSchema", () => {
  it.each([0, 100, 40, "40", "40.5", "40.25", "0", "100.00"])("accepts %s", (v) => {
    expect(profitSharePercentSchema.safeParse(v).success).toBe(true);
  });

  it.each(["", "40.123", "101", 100.5, -1, "-5", "abc", " ", 40.123])("rejects %j", (v) => {
    expect(profitSharePercentSchema.safeParse(v).success).toBe(false);
  });
});

describe("createHomeworkerSchema", () => {
  it("accepts email only", () => {
    expect(createHomeworkerSchema.safeParse({ body: { email: "a@b.com" } }).success).toBe(true);
  });

  it("accepts the optional fields", () => {
    const r = createHomeworkerSchema.safeParse({
      body: { email: "a@b.com", firstName: "A", lastName: "B", profitSharePercent: "40.5", displayName: "A's Travel" },
    });
    expect(r.success).toBe(true);
  });

  it("rejects an invalid email and an empty or over-precise share", () => {
    expect(createHomeworkerSchema.safeParse({ body: { email: "nope" } }).success).toBe(false);
    expect(createHomeworkerSchema.safeParse({ body: { email: "a@b.com", profitSharePercent: "" } }).success).toBe(false);
    expect(createHomeworkerSchema.safeParse({ body: { email: "a@b.com", profitSharePercent: "40.123" } }).success).toBe(false);
  });
});

describe("invite discriminated union (sendInviteSchema)", () => {
  it("accepts a homeworker without branchId", () => {
    expect(sendInviteSchema.safeParse({ body: { email: "a@b.com", orgRole: "homeworker" } }).success).toBe(true);
  });

  it("accepts homeworker with share and displayName", () => {
    const r = sendInviteSchema.safeParse({
      body: { email: "a@b.com", orgRole: "homeworker", profitSharePercent: 40, displayName: "Jo" },
    });
    expect(r.success).toBe(true);
  });

  it("rejects an agent without branchId", () => {
    expect(sendInviteSchema.safeParse({ body: { email: "a@b.com", orgRole: "agent" } }).success).toBe(false);
  });

  it("accepts an agent with branchId", () => {
    expect(sendInviteSchema.safeParse({ body: { email: "a@b.com", orgRole: "agent", branchId: BRANCH_ID } }).success).toBe(true);
  });

  it("rejects bad profit shares on the homeworker arm", () => {
    for (const profitSharePercent of ["", "40.123"]) {
      expect(
        sendInviteSchema.safeParse({ body: { email: "a@b.com", orgRole: "homeworker", profitSharePercent } }).success,
      ).toBe(false);
    }
  });

  it("rejects an unknown role", () => {
    expect(sendInviteSchema.safeParse({ body: { email: "a@b.com", orgRole: "org_admin", branchId: BRANCH_ID } }).success).toBe(false);
  });
});

describe("HR invite discriminated union (inviteEmployeeBodySchema)", () => {
  it("accepts a homeworker without branchId and rejects a branch role without one", () => {
    expect(inviteEmployeeBodySchema.safeParse({ email: "a@b.com", orgRole: "homeworker" }).success).toBe(true);
    expect(inviteEmployeeBodySchema.safeParse({ email: "a@b.com", orgRole: "agent" }).success).toBe(false);
    expect(inviteEmployeeBodySchema.safeParse({ email: "a@b.com", orgRole: "branch_manager", branchId: BRANCH_ID }).success).toBe(true);
  });

  it("rejects bad shares", () => {
    expect(inviteEmployeeBodySchema.safeParse({ email: "a@b.com", orgRole: "homeworker", profitSharePercent: "" }).success).toBe(false);
    expect(inviteEmployeeBodySchema.safeParse({ email: "a@b.com", orgRole: "homeworker", profitSharePercent: "40.123" }).success).toBe(false);
  });
});

describe("updateHomeworkerSchema", () => {
  it("requires a uuid branchId and at least one field", () => {
    expect(updateHomeworkerSchema.safeParse({ params: { branchId: "x" }, body: { name: "A" } }).success).toBe(false);
    expect(updateHomeworkerSchema.safeParse({ params: { branchId: BRANCH_ID }, body: {} }).success).toBe(false);
    expect(updateHomeworkerSchema.safeParse({ params: { branchId: BRANCH_ID }, body: { profitSharePercent: "12.5" } }).success).toBe(true);
    expect(updateHomeworkerSchema.safeParse({ params: { branchId: BRANCH_ID }, body: { name: "A" } }).success).toBe(true);
  });

  it("rejects a bad share", () => {
    expect(updateHomeworkerSchema.safeParse({ params: { branchId: BRANCH_ID }, body: { profitSharePercent: "" } }).success).toBe(false);
  });
});

describe("list and params schemas", () => {
  it("accepts includeArchived true/false only", () => {
    expect(listHomeworkersSchema.safeParse({ query: { includeArchived: "true" } }).success).toBe(true);
    expect(listHomeworkersSchema.safeParse({ query: {} }).success).toBe(true);
    expect(listHomeworkersSchema.safeParse({ query: { includeArchived: "yes" } }).success).toBe(false);
  });

  it("requires a uuid branchId for archive", () => {
    expect(homeworkerBranchParamsSchema.safeParse({ params: { branchId: BRANCH_ID } }).success).toBe(true);
    expect(homeworkerBranchParamsSchema.safeParse({ params: { branchId: "x" } }).success).toBe(false);
  });
});

describe("statement schemas", () => {
  it("accepts optional ISO dates on the statement query and rejects malformed ones", () => {
    expect(statementQuerySchema.safeParse({ params: { branchId: BRANCH_ID }, query: {} }).success).toBe(true);
    expect(statementQuerySchema.safeParse({ params: { branchId: BRANCH_ID }, query: { from: "2026-03-01", to: "2026-04-01" } }).success).toBe(true);
    expect(statementQuerySchema.safeParse({ params: { branchId: BRANCH_ID }, query: { from: "03/01/2026" } }).success).toBe(false);
    expect(statementQuerySchema.safeParse({ params: { branchId: "x" }, query: {} }).success).toBe(false);
    expect(myStatementQuerySchema.safeParse({ query: { to: "2026-04-01" } }).success).toBe(true);
    expect(myStatementQuerySchema.safeParse({ query: { to: "soon" } }).success).toBe(false);
  });

  it("requires both dates on finalise", () => {
    expect(finaliseStatementSchema.safeParse({ params: { branchId: BRANCH_ID }, body: { from: "2026-03-01", to: "2026-04-01" } }).success).toBe(true);
    expect(finaliseStatementSchema.safeParse({ params: { branchId: BRANCH_ID }, body: { from: "2026-03-01" } }).success).toBe(false);
    expect(finaliseStatementSchema.safeParse({ params: { branchId: BRANCH_ID }, body: {} }).success).toBe(false);
  });
});
