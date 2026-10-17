import { describe, expect, it } from "vitest";
import {
  ADMIN_ROLE_HINT,
  MAX_ROWS,
  blankRow,
  firstError,
  isBlankRow,
  lockRowsToBranch,
  matchBranch,
  matchRole,
  padRows,
  rowToInviteBody,
  tableToInviteRows,
  unsentRows,
  validateRow,
  validateRows,
  type InviteRow,
  type ValidationContext,
} from "./invite-rows";

const branches = [
  { id: "b1", name: "Tinas Travel Deals" },
  { id: "b2", name: "Leeds" },
];

const ctx: ValidationContext = {
  branches,
  takenEmails: new Set(["taken@example.com"]),
  allowedRoles: ["branch_manager", "agent", "social_media_manager", "homeworker", "referral_agent"],
};

const row = (over: Partial<InviteRow> = {}): InviteRow => ({
  ...blankRow(),
  first: "Sam",
  last: "Rivers",
  email: "sam@example.com",
  role: "agent",
  branchId: "b1",
  ...over,
});

describe("matchRole", () => {
  it("maps labels and aliases to invitable roles", () => {
    expect(matchRole("Agent").role).toBe("agent");
    expect(matchRole("Travel Consultant").role).toBe("agent");
    expect(matchRole("branch manager").role).toBe("branch_manager");
    expect(matchRole("Social Media Manager").role).toBe("social_media_manager");
    expect(matchRole("Homeworker").role).toBe("homeworker");
    expect(matchRole("Referral partner").role).toBe("referral_agent");
  });

  it("rejects Owner / Admin and Sales Manager with the hint", () => {
    for (const raw of ["Owner / Admin", "admin", "Sales Manager"]) {
      const m = matchRole(raw);
      expect(m.role).toBe("");
      expect(m.issue).toContain(ADMIN_ROLE_HINT);
    }
  });

  it("flags unknown roles and ignores empty ones", () => {
    expect(matchRole("wizard").issue).toContain("Unknown role");
    expect(matchRole("  ")).toEqual({ role: "", issue: "" });
  });
});

describe("matchBranch", () => {
  it("matches by name ignoring case and punctuation", () => {
    expect(matchBranch("tinas travel deals", "agent", branches).branchId).toBe("b1");
    expect(matchBranch("LEEDS", "agent", branches).branchId).toBe("b2");
  });

  it("keeps unmatched text for the error message", () => {
    expect(matchBranch("Paris", "agent", branches)).toEqual({ branchId: "", branchText: "Paris" });
  });

  it("gives homeworkers no branch", () => {
    expect(matchBranch("Leeds", "homeworker", branches)).toEqual({ branchId: "", branchText: "" });
  });
});

describe("tableToInviteRows", () => {
  it("reads rows by header name in any order", () => {
    const rows = tableToInviteRows(
      [
        ["Email", "Surname", "First name", "Branch", "Role"],
        ["a@x.com", "Taylor", "Alex", "Leeds", "Agent"],
      ],
      branches,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ first: "Alex", last: "Taylor", email: "a@x.com", role: "agent", branchId: "b2" });
  });

  it("falls back to the template column order without a header", () => {
    const rows = tableToInviteRows([["Alex", "Taylor", "a@x.com", "Agent", "Leeds"]], branches);
    expect(rows[0]).toMatchObject({ first: "Alex", email: "a@x.com", branchId: "b2" });
  });

  it("drops blank lines and marks rejected roles", () => {
    const rows = tableToInviteRows(
      [
        ["First name", "Last name", "Email", "Role", "Branch"],
        ["", "", "", "", ""],
        ["Tom", "Reid", "t@x.com", "Sales Manager", "Leeds"],
      ],
      branches,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].role).toBe("");
    expect(rows[0].roleIssue).toContain(ADMIN_ROLE_HINT);
  });
});

describe("validateRow", () => {
  it("accepts a complete row", () => {
    expect(validateRow(row(), ctx)).toEqual({});
  });

  it("requires names, a valid email and a role", () => {
    const e = validateRow(row({ first: "", last: "", email: "nope", role: "" }), ctx);
    expect(e.first).toBeDefined();
    expect(e.last).toBeDefined();
    expect(e.email).toBe("Enter a valid email address");
    expect(e.role).toBe("Choose a role");
  });

  it("reports a rejected role with its hint", () => {
    const e = validateRow(row({ role: "", roleIssue: `Owner: ${ADMIN_ROLE_HINT}` }), ctx);
    expect(e.role).toContain(ADMIN_ROLE_HINT);
  });

  it("flags emails already in the team", () => {
    expect(validateRow(row({ email: "TAKEN@example.com" }), ctx).email).toContain("already uses");
  });

  it("needs a known branch for non-homeworkers, not for homeworkers", () => {
    expect(validateRow(row({ branchId: "", branchText: "Paris" }), ctx).branch).toBe('Branch "Paris" not found');
    expect(validateRow(row({ branchId: "" }), ctx).branch).toBe("Choose a branch");
    expect(validateRow(row({ role: "homeworker", branchId: "" }), ctx).branch).toBeUndefined();
  });

  it("locks branch managers to their own branch and to agents", () => {
    const locked: ValidationContext = { ...ctx, allowedRoles: ["agent"], lockedBranchId: "b1" };
    expect(validateRow(row({ branchId: "b2" }), locked).branch).toBe("You can only invite to your own branch");
    expect(validateRow(row({ role: "branch_manager" }), locked).role).toContain("can't invite");
    expect(validateRow(row(), locked)).toEqual({});
  });
});

describe("validateRows", () => {
  it("flags the second copy of an email and skips blank rows", () => {
    const a = row({ email: "dup@example.com" });
    const b = row({ email: "DUP@example.com" });
    const errors = validateRows([a, blankRow(), b], ctx);
    expect(errors[a.id]).toBeUndefined();
    expect(errors[b.id]?.email).toBe("This email is in your list twice");
    expect(Object.keys(errors)).toHaveLength(1);
  });

  it("firstError picks the first problem in column order", () => {
    expect(firstError({ email: "e", role: "r" })).toBe("e");
    expect(firstError({})).toBeNull();
    expect(firstError(undefined)).toBeNull();
  });
});

describe("rows", () => {
  it("pads to five visible rows and keeps long lists intact", () => {
    expect(padRows([])).toHaveLength(5);
    expect(padRows(Array.from({ length: 8 }, blankRow))).toHaveLength(8);
    expect(MAX_ROWS).toBe(200);
  });

  it("knows a blank row", () => {
    expect(isBlankRow(blankRow())).toBe(true);
    expect(isBlankRow(row())).toBe(false);
  });
});

describe("rowToInviteBody", () => {
  it("builds the branch arm with names", () => {
    expect(rowToInviteBody(row({ email: " Sam@Example.com " }))).toEqual({
      email: "Sam@Example.com",
      orgRole: "agent",
      branchId: "b1",
      firstName: "Sam",
      lastName: "Rivers",
    });
  });

  it("builds the homeworker arm without a branch or share, using the name as display name", () => {
    expect(rowToInviteBody(row({ role: "homeworker", branchId: "" }))).toEqual({
      email: "sam@example.com",
      orgRole: "homeworker",
      displayName: "Sam Rivers",
    });
  });
});

describe("lockRowsToBranch", () => {
  it("points non-homeworker rows at the locked branch and leaves homeworkers and blanks alone", () => {
    const rows = [row({ branchId: "b2" }), row({ role: "homeworker", branchId: "" }), blankRow()];
    const out = lockRowsToBranch(rows, "b1");
    expect(out[0].branchId).toBe("b1");
    expect(out[1].branchId).toBe("");
    expect(out[2].branchId).toBe("");
  });

  it("does nothing without a lock", () => {
    const rows = [row({ branchId: "b2" })];
    expect(lockRowsToBranch(rows, null)).toBe(rows);
  });
});

describe("partial send then retry", () => {
  it("leaves sent rows out of validation so their now-taken emails do not block the retry", () => {
    const sent = row({ email: "sent@example.com" });
    const failed = row({ email: "retry@example.com" });
    const afterSend: ValidationContext = { ...ctx, takenEmails: new Set(["taken@example.com", "sent@example.com"]) };
    const results = { [sent.id]: { status: "sent" } };

    expect(validateRows([sent, failed], afterSend)[sent.id]?.email).toContain("already uses");
    const retry = unsentRows([sent, failed], results);
    expect(retry.map((r) => r.id)).toEqual([failed.id]);
    expect(validateRows(retry, afterSend)).toEqual({});
  });

  it("keeps failed and untouched rows", () => {
    const a = row();
    const b = row({ email: "b@example.com" });
    expect(unsentRows([a, b], { [a.id]: { status: "failed" } })).toHaveLength(2);
  });
});

describe("lockRowsToBranch regardless of role", () => {
  it("locks a filled row whose role is not set yet, but not blank rows", () => {
    const noRole = row({ role: "", branchId: "b2" });
    expect(lockRowsToBranch([noRole, blankRow()], "b1").map((r) => r.branchId)).toEqual(["b1", ""]);
  });
});

describe("spreadsheet header aliases", () => {
  it("does not treat title columns as the role column", () => {
    const rows = tableToInviteRows([["Title", "First name", "Email"], ["Mr", "Al", "a@x.com"]], branches);
    expect(rows[0].role).toBe("");
  });
});
