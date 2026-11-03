import { describe, it, expect } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import {
  branches,
  clientTable,
  homeworkerPayoutStatement,
  insertHomeworkerPayoutStatementSchema,
  insertBranchSchema,
} from "./schema";

describe("branches homeworker columns", () => {
  const cols = getTableColumns(branches);
  const cfg = getTableConfig(branches);

  it("has nullable owner_user_id and profit_share_percent", () => {
    expect(cols.ownerUserId.name).toBe("owner_user_id");
    expect(cols.ownerUserId.notNull).toBe(false);
    expect(cols.profitSharePercent.name).toBe("profit_share_percent");
    expect(cols.profitSharePercent.notNull).toBe(false);
  });

  it("keeps branch_type default 'shop'", () => {
    expect(cols.branchType.default).toBe("shop");
    expect(cols.branchType.notNull).toBe(true);
  });

  it("declares the unique owner, type index and three checks", () => {
    expect(cfg.uniqueConstraints.map((u) => u.name)).toContain("branches_owner_user_id_unique");
    expect(cfg.indexes.map((i) => i.config.name)).toEqual(
      expect.arrayContaining(["idx_branches_org_id", "idx_branches_org_type"]),
    );
    expect(cfg.checks.map((c) => c.name).sort()).toEqual([
      "branches_branch_type_check",
      "branches_homeworker_fields_check",
      "branches_profit_share_range",
    ]);
  });
});

describe("client_table split_from_client_id", () => {
  it("is a nullable self-referencing column", () => {
    const col = getTableColumns(clientTable).splitFromClientId;
    expect(col.name).toBe("split_from_client_id");
    expect(col.notNull).toBe(false);
    const fk = getTableConfig(clientTable).foreignKeys.find(
      (f) => f.reference().columns[0].name === "split_from_client_id",
    );
    expect(fk?.onDelete).toBe("set null");
  });
});

describe("homeworker_payout_statement", () => {
  const cols = getTableColumns(homeworkerPayoutStatement);
  const cfg = getTableConfig(homeworkerPayoutStatement);

  it("has expected table name and column nullability", () => {
    expect(cfg.name).toBe("homeworker_payout_statement");
    for (const k of ["orgId", "branchId", "periodStart", "periodEnd", "grossProfit", "sharePercent", "homeworkerShare", "orgShare", "status"] as const) {
      expect(cols[k].notNull).toBe(true);
    }
    for (const k of ["userId", "finalisedBy", "finalisedAt"] as const) {
      expect(cols[k].notNull).toBe(false);
    }
    expect(cols.status.default).toBe("draft");
  });

  it("declares unique (branch, period), org/period index and status check", () => {
    expect(cfg.uniqueConstraints.map((u) => u.name)).toContain("homeworker_payout_branch_period_unique");
    expect(cfg.indexes.map((i) => i.config.name)).toContain("idx_homeworker_payout_org_period");
    expect(cfg.checks.map((c) => c.name)).toContain("homeworker_payout_status_check");
  });
});

describe("insertHomeworkerPayoutStatementSchema", () => {
  const valid = {
    orgId: "11111111-1111-4111-8111-111111111111",
    branchId: "22222222-2222-4222-8222-222222222222",
    periodStart: "2026-10-01",
    periodEnd: "2026-10-31",
    grossProfit: "1000.00",
    sharePercent: "40.00",
    homeworkerShare: "400.00",
    orgShare: "600.00",
    status: "draft" as const,
  };

  it("accepts a valid statement", () => {
    expect(insertHomeworkerPayoutStatementSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects share percent above 100 or below 0", () => {
    expect(insertHomeworkerPayoutStatementSchema.safeParse({ ...valid, sharePercent: "100.01" }).success).toBe(false);
    expect(insertHomeworkerPayoutStatementSchema.safeParse({ ...valid, sharePercent: "-1" }).success).toBe(false);
  });

  it("rejects status outside draft/final", () => {
    expect(insertHomeworkerPayoutStatementSchema.safeParse({ ...valid, status: "paid" }).success).toBe(false);
    expect(insertHomeworkerPayoutStatementSchema.safeParse({ ...valid, status: "final" }).success).toBe(true);
  });
});

const dialect = new PgDialect();
const checkSql = (t: Parameters<typeof getTableConfig>[0], name: string): string => {
  const c = getTableConfig(t).checks.find((x) => x.name === name);
  if (!c) throw new Error(`missing check ${name}`);
  return dialect.sqlToQuery(c.value).sql;
};
const fkDelete = (t: Parameters<typeof getTableConfig>[0], col: string) =>
  getTableConfig(t).foreignKeys.find((f) => f.reference().columns[0].name === col)?.onDelete;

describe("CHECK constraint SQL", () => {
  it("branches checks", () => {
    expect(checkSql(branches, "branches_branch_type_check")).toContain(`"branch_type" IN ('shop', 'homeworker')`);
    const range = checkSql(branches, "branches_profit_share_range");
    expect(range).toContain(`"profit_share_percent" IS NULL OR`);
    expect(range).toContain("BETWEEN 0 AND 100");
    const fields = checkSql(branches, "branches_homeworker_fields_check");
    expect(fields).toContain(`"branch_type" = 'homeworker'`);
    expect(fields).toContain(`"owner_user_id" IS NULL AND`);
    expect(fields).toContain(`"profit_share_percent" IS NULL`);
  });

  it("payout checks", () => {
    expect(checkSql(homeworkerPayoutStatement, "homeworker_payout_status_check")).toContain(`"status" IN ('draft', 'final')`);
    expect(checkSql(homeworkerPayoutStatement, "homeworker_payout_period_order")).toContain(`"period_end" > "homeworker_payout_statement"."period_start"`);
    const share = checkSql(homeworkerPayoutStatement, "homeworker_payout_share_range");
    expect(share).toContain(`"share_percent" BETWEEN 0 AND 100`);
  });
});

describe("foreign key onDelete", () => {
  it("branches.owner_user_id sets null", () => {
    expect(fkDelete(branches, "owner_user_id")).toBe("set null");
  });
  it("payout FKs", () => {
    expect(fkDelete(homeworkerPayoutStatement, "org_id")).toBe("cascade");
    expect(fkDelete(homeworkerPayoutStatement, "branch_id")).toBe("cascade");
    expect(fkDelete(homeworkerPayoutStatement, "user_id")).toBe("set null");
    expect(fkDelete(homeworkerPayoutStatement, "finalised_by")).toBe("set null");
  });
});

describe("zod percent and branch type validation", () => {
  const payout = {
    orgId: "11111111-1111-4111-8111-111111111111",
    branchId: "22222222-2222-4222-8222-222222222222",
    periodStart: "2026-10-01",
    periodEnd: "2026-10-31",
    grossProfit: "1000.00",
    homeworkerShare: "400.00",
    orgShare: "600.00",
    status: "draft" as const,
  };
  const branch = { organizationId: "11111111-1111-4111-8111-111111111111", name: "HW", branchType: "homeworker" as const };

  it("rejects empty string and 3-decimal share percent on payout", () => {
    expect(insertHomeworkerPayoutStatementSchema.safeParse({ ...payout, sharePercent: "" }).success).toBe(false);
    expect(insertHomeworkerPayoutStatementSchema.safeParse({ ...payout, sharePercent: "40.123" }).success).toBe(false);
    expect(insertHomeworkerPayoutStatementSchema.safeParse({ ...payout, sharePercent: "100" }).success).toBe(true);
  });

  it("validates branch profitSharePercent", () => {
    expect(insertBranchSchema.safeParse({ ...branch, profitSharePercent: "" }).success).toBe(false);
    expect(insertBranchSchema.safeParse({ ...branch, profitSharePercent: "40.123" }).success).toBe(false);
    expect(insertBranchSchema.safeParse({ ...branch, profitSharePercent: "100.5" }).success).toBe(false);
    expect(insertBranchSchema.safeParse({ ...branch, profitSharePercent: "40.5" }).success).toBe(true);
    expect(insertBranchSchema.safeParse({ ...branch, profitSharePercent: null }).success).toBe(true);
  });

  it("restricts branchType to shop/homeworker", () => {
    expect(insertBranchSchema.safeParse({ ...branch, branchType: "other" }).success).toBe(false);
    expect(insertBranchSchema.safeParse({ ...branch, branchType: "shop" }).success).toBe(true);
  });
});
