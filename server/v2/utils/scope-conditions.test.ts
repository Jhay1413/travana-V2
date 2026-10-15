import { describe, it, expect } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { sql, type SQL } from "drizzle-orm";
import { transaction, clientTable } from "@shared/schema";
import {
  buildPartitionCond,
  buildUserPartitionCond,
  buildTransactionScopeConds,
  buildTransactionRecordScopeConds,
  buildScopeConditions,
} from "./scope-conditions";
import type { Scope } from "./scope";

const dialect = new PgDialect();
const render = (clause: SQL | undefined) => {
  if (!clause) return undefined;
  const q = dialect.sqlToQuery(clause);
  return { text: q.sql, params: q.params };
};

function scopeOf(over: Partial<Scope>): Scope {
  return {
    orgId: "org1",
    branchId: null,
    orgRole: "agent",
    orgRoles: ["agent"],
    userId: "u1",
    branchType: "shop",
    ownsHomeworkerBranch: false,
    ...over,
  };
}

const EXCLUDE_HOMEWORKER_BRANCHES =
  /is null or .*"transaction"\."branch_id" NOT IN \(SELECT "branches"\."id" FROM "branches" WHERE "branches"\."organization_id" = \$1 AND "branches"\."branch_type" = 'homeworker'\)/i;

const HOMEWORKER_OWN = scopeOf({
  orgRole: "homeworker",
  orgRoles: ["homeworker"],
  branchId: "hw1",
  branchType: "homeworker",
  ownsHomeworkerBranch: true,
});

describe("buildPartitionCond", () => {
  const bc = transaction.branch_id;
  const oc = transaction.user_id;

  it("returns undefined for the trusted scope", () => {
    expect(buildPartitionCond({ orgId: null }, bc, oc)).toBeUndefined();
  });

  it("returns undefined for platform_admin and org_admin", () => {
    expect(buildPartitionCond(scopeOf({ orgRole: "platform_admin", orgRoles: ["platform_admin"] }), bc, oc)).toBeUndefined();
    expect(buildPartitionCond(scopeOf({ orgRole: "org_admin", orgRoles: ["org_admin"] }), bc, oc)).toBeUndefined();
  });

  it("homeworker in own branch: branch AND owner", () => {
    const r = render(buildPartitionCond(HOMEWORKER_OWN, bc, oc));
    expect(r?.text).toContain('"transaction"."branch_id" = $1');
    expect(r?.text).toContain('"transaction"."user_id" = $2');
    expect(r?.text).toMatch(/ and /i);
    expect(r?.params).toEqual(["hw1", "u1"]);
  });

  it("homeworker in own branch without ownerCol: branch only", () => {
    const r = render(buildPartitionCond(HOMEWORKER_OWN, bc));
    expect(r?.text).toBe('"transaction"."branch_id" = $1');
    expect(r?.params).toEqual(["hw1"]);
  });

  it("legacy homeworker in a shared branch: per-user rule on ownerCol", () => {
    const r = render(
      buildPartitionCond(
        scopeOf({ orgRole: "homeworker", orgRoles: ["homeworker"], branchId: "shared", branchType: "homeworker" }),
        bc,
        oc,
      ),
    );
    expect(r?.text).toBe('"transaction"."user_id" = $1');
    expect(r?.params).toEqual(["u1"]);
  });

  it("legacy homeworker without ownerCol: falls back to their branch", () => {
    const r = render(
      buildPartitionCond(scopeOf({ orgRole: "homeworker", orgRoles: ["homeworker"], branchId: "shared" }), bc),
    );
    expect(r?.text).toBe('"transaction"."branch_id" = $1');
    expect(r?.params).toEqual(["shared"]);
  });

  it("detects a homeworker who also holds agent (primary agent)", () => {
    const r = render(
      buildPartitionCond(scopeOf({ orgRole: "agent", orgRoles: ["agent", "homeworker"], branchId: "shared" }), bc, oc),
    );
    expect(r?.text).toBe('"transaction"."user_id" = $1');
  });

  it("fails closed for a homeworker with no user id", () => {
    const r = render(
      buildPartitionCond(scopeOf({ orgRole: "homeworker", orgRoles: ["homeworker"], userId: null }), bc, oc),
    );
    expect(r?.text).toBe("false");
  });

  it.each(["branch_manager", "agent", "social_media_manager", "referral_agent"] as const)(
    "%s: IS NULL OR NOT IN homeworker branches of the org",
    (role) => {
      const r = render(buildPartitionCond(scopeOf({ orgRole: role, orgRoles: [role], branchId: "b1" }), bc, oc));
      expect(r?.text).toMatch(EXCLUDE_HOMEWORKER_BRANCHES);
      expect(r?.params).toEqual(["org1"]);
    },
  );
});

describe("buildUserPartitionCond", () => {
  it("is undefined for trusted, platform_admin and org_admin", () => {
    expect(buildUserPartitionCond({ orgId: null }, clientTable.createdBy)).toBeUndefined();
    expect(
      buildUserPartitionCond(scopeOf({ orgRole: "platform_admin", orgRoles: ["platform_admin"] }), clientTable.createdBy),
    ).toBeUndefined();
    expect(
      buildUserPartitionCond(scopeOf({ orgRole: "org_admin", orgRoles: ["org_admin"] }), clientTable.createdBy),
    ).toBeUndefined();
  });

  it("restricts a homeworker to themselves", () => {
    const r = render(
      buildUserPartitionCond(scopeOf({ orgRole: "homeworker", orgRoles: ["homeworker"] }), clientTable.createdBy),
    );
    expect(r?.params).toEqual(["u1"]);
  });

  it("hides homeworker-branch members from everyone else", () => {
    const r = render(buildUserPartitionCond(scopeOf({ orgRole: "agent" }), clientTable.createdBy));
    expect(r?.text).toContain("NOT IN (SELECT");
    expect(r?.text).toContain("'homeworker'");
    expect(r?.params).toEqual(["org1"]);
  });
});

describe("transaction scope conditions use the partition helper", () => {
  it("trusted scope yields no conditions", () => {
    expect(buildTransactionScopeConds({ orgId: null })).toEqual([]);
    expect(buildTransactionRecordScopeConds({ orgId: null })).toEqual([]);
  });

  it("org_admin gets only the org filter", () => {
    const s = scopeOf({ orgRole: "org_admin", orgRoles: ["org_admin"], branchId: "b1" });
    expect(buildTransactionScopeConds(s)).toHaveLength(1);
    expect(buildTransactionRecordScopeConds(s)).toHaveLength(1);
  });

  it("agent: org + branch pin + homeworker exclusion (list); org + exclusion (record)", () => {
    const s = scopeOf({ orgRole: "agent", branchId: "b1" });
    const list = buildTransactionScopeConds(s).map(render);
    expect(list).toHaveLength(3);
    expect(list[2]?.text).toMatch(EXCLUDE_HOMEWORKER_BRANCHES);
    const record = buildTransactionRecordScopeConds(s).map(render);
    expect(record).toHaveLength(2);
    expect(record[1]?.text).toMatch(EXCLUDE_HOMEWORKER_BRANCHES);
  });

  it("homeworker in own branch: org + branch + owner", () => {
    const conds = buildTransactionRecordScopeConds(HOMEWORKER_OWN).map(render);
    expect(conds[1]?.text).toContain('"transaction"."branch_id"');
    expect(conds[1]?.text).toContain('"transaction"."user_id"');
  });

  it("legacy homeworker keeps the per-user rule", () => {
    const s = scopeOf({ orgRole: "homeworker", orgRoles: ["homeworker"], branchId: "shared" });
    const conds = buildTransactionScopeConds(s).map(render);
    expect(conds[1]?.text).toBe('"transaction"."user_id" = $1');
  });
});

describe("buildPartitionCond owner expressions and the transitional NULL arm", () => {
  const bc = transaction.branch_id;
  const selfExpr = sql`(${transaction.user_id} = ${"hw"} OR ${transaction.org_id} = ${"hw"})`;
  const LEGACY = scopeOf({ orgRole: "homeworker", orgRoles: ["homeworker"], branchId: "shop-b", userId: "hw", branchType: "shop" });
  const OWN = scopeOf({ orgRole: "homeworker", orgRoles: ["homeworker"], branchId: "hw1", userId: "hw", branchType: "homeworker", ownsHomeworkerBranch: true });

  it("a legacy homeworker with an SQL owner uses it as-is instead of pinning to the branch", () => {
    const r = render(buildPartitionCond(LEGACY, bc, selfExpr));
    expect(r?.text).toContain('"transaction"."user_id" = $1');
    expect(r?.text).not.toContain('"branch_id" = ');
  });

  it("an own-branch homeworker with an SQL owner gets branch AND owner", () => {
    const r = render(buildPartitionCond(OWN, bc, selfExpr));
    expect(r?.text).toContain('"transaction"."branch_id" = $1');
    expect(r?.text).toContain('"transaction"."user_id" = $2');
  });

  it("allowNullBranchForOwner adds (branch IS NULL AND owner) for a homeworker", () => {
    const r = render(buildPartitionCond(OWN, bc, transaction.user_id, { allowNullBranchForOwner: true }));
    expect(r?.text).toMatch(/"transaction"."branch_id" is null and "transaction"."user_id" = \$\d/i);
    expect(r?.params).toEqual(["hw1", "hw", "hw"]);
  });

  it("allowNullBranchForOwner does nothing without an owner, or for shop staff", () => {
    expect(render(buildPartitionCond(OWN, bc, undefined, { allowNullBranchForOwner: true }))?.text).toBe('"transaction"."branch_id" = $1');
    const shop = render(buildPartitionCond(scopeOf({}), bc, transaction.user_id, { allowNullBranchForOwner: true }));
    expect(shop?.text).toMatch(EXCLUDE_HOMEWORKER_BRANCHES);
    expect(shop?.text).not.toContain('"user_id" = ');
  });
});

describe("buildScopeConditions partitionScope", () => {
  it("adds nothing without partitionScope (callers that are not partition-aware)", () => {
    expect(buildScopeConditions({ orgId: "org1", branchId: null })).toHaveLength(2);
  });

  it("adds the exclusion for shop staff and nothing for org_admin", () => {
    const shop = buildScopeConditions({ orgId: "org1", branchId: null, partitionScope: scopeOf({}) });
    expect(shop).toHaveLength(3);
    expect(render(shop[2])?.text).toMatch(EXCLUDE_HOMEWORKER_BRANCHES);
    const admin = buildScopeConditions({ orgId: "org1", branchId: null, partitionScope: scopeOf({ orgRole: "org_admin", orgRoles: ["org_admin"] }) });
    expect(admin).toHaveLength(2);
  });
});
