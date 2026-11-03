import { describe, it, expect, vi } from "vitest";
import {
  exitCodeFor,
  expectCount,
  maskDatabaseUrl,
  parseArgs,
  runPerOrg,
  summariseOutcomes,
  type OrgOutcome,
} from "./migration-cli";

const ORG = "6f1d2c3e-1a2b-4c3d-8e9f-0a1b2c3d4e5f";

describe("parseArgs", () => {
  it("defaults to a dry run", () => {
    expect(parseArgs([])).toEqual({ apply: false, force: false, orgId: null, confirmDb: null });
  });

  it("parses apply, confirm-db, org and force", () => {
    expect(parseArgs(["--apply", "--confirm-db", "prod", "--org", ORG, "--force"])).toEqual({
      apply: true,
      force: true,
      orgId: ORG,
      confirmDb: "prod",
    });
  });

  it("rejects unknown flags", () => {
    expect(() => parseArgs(["--aply"])).toThrow(/Unknown argument/);
  });

  it("rejects a non-uuid --org and a missing value", () => {
    expect(() => parseArgs(["--org", "not-a-uuid"])).toThrow(/uuid/);
    expect(() => parseArgs(["--org"])).toThrow(/uuid/);
  });

  it("rejects --confirm-db without a value and --force without --apply", () => {
    expect(() => parseArgs(["--confirm-db"])).toThrow(/database name/);
    expect(() => parseArgs(["--force"])).toThrow(/--apply/);
  });
});

describe("maskDatabaseUrl", () => {
  it("shows only host and database, never credentials", () => {
    const masked = maskDatabaseUrl("postgresql://user:s3cret@db.example.com:5432/travana?sslmode=require");
    expect(masked).toBe("host=db.example.com database=travana");
    expect(masked).not.toContain("s3cret");
    expect(masked).not.toContain("user");
  });

  it("handles the psql wrapper form and unparseable values", () => {
    expect(maskDatabaseUrl("psql 'postgresql://u:p@h.example/dbname'")).toBe("host=h.example database=dbname");
    expect(maskDatabaseUrl("")).toContain("unknown");
  });
});

describe("expectCount", () => {
  it("passes on a match and throws a rollback error on a mismatch", () => {
    expect(() => expectCount(3, 3, "set_branch(tickets)")).not.toThrow();
    expect(() => expectCount(2, 3, "set_branch(tickets)")).toThrow(/expected 3 row\(s\) but 2/);
  });
});

describe("runPerOrg (error isolation)", () => {
  const orgs = [
    { id: "o1", name: "One" },
    { id: "o2", name: "Two" },
    { id: "o3", name: "Three" },
  ];

  it("logs a failing org, keeps going and records the outcomes", async () => {
    const log = vi.fn();
    const seen: string[] = [];
    const outcomes = await runPerOrg(
      orgs,
      async (org) => {
        seen.push(org.id);
        if (org.id === "o2") throw new Error("row count mismatch");
        return { status: "committed", detail: "5 operation(s)" };
      },
      log,
    );
    expect(seen).toEqual(["o1", "o2", "o3"]);
    expect(outcomes.map((o) => o.status)).toEqual(["committed", "failed", "committed"]);
    expect(outcomes[1]).toMatchObject({ orgId: "o2", name: "Two", detail: "row count mismatch" });
    expect(log).toHaveBeenCalledWith(expect.stringContaining("o2 (Two)"));
  });

  it("summarises committed versus failed", async () => {
    const outcomes = await runPerOrg(orgs, async (org) => {
      if (org.id === "o1") throw new Error("x");
      return { status: org.id === "o2" ? "refused" : "committed" };
    }, () => undefined);
    expect(summariseOutcomes(outcomes)).toEqual({ planned: 0, committed: 1, refused: 1, failed: 1, nothing: 0 });
  });
});

describe("exitCodeFor", () => {
  const o = (status: OrgOutcome["status"]): OrgOutcome => ({ orgId: "o", name: "n", status });

  it("is 0 for a clean dry run and for a clean apply", () => {
    expect(exitCodeFor([o("planned")], false)).toBe(0);
    expect(exitCodeFor([o("committed"), o("nothing")], true)).toBe(0);
  });

  it("is 1 when any org failed, in either mode", () => {
    expect(exitCodeFor([o("committed"), o("failed")], true)).toBe(1);
    expect(exitCodeFor([o("failed")], false)).toBe(1);
  });

  it("is 2 only when an apply refused an org because of blocking conflicts", () => {
    expect(exitCodeFor([o("refused")], true)).toBe(2);
    expect(exitCodeFor([o("refused")], false)).toBe(0);
  });
});
