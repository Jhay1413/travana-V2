import { describe, it, expect } from "vitest";
import {
  CLIENT_COPY_RESET_FIELDS,
  RowAssignments,
  blockingConflicts,
  formatReport,
  homeworkerBranchName,
  informationalConflicts,
  newBranchRef,
  newClientRef,
  orgHasHomeworkers,
  planClientSplit,
  planOrgMigration,
  type OrgMigrationInput,
  type PlanOperation,
} from "./homeworker-migration-plan";

function input(over: Partial<OrgMigrationInput> = {}): OrgMigrationInput {
  return {
    org: { id: "o1", homeworkerCommission: 60 },
    users: [
      { id: "h1", firstName: "Hannah", lastName: "Hart", name: "Hannah Hart", email: "hannah@x.com" },
      // Display name is just the email and there is no real first/last name (S5).
      { id: "h2", firstName: "", lastName: "—", name: "Ian.Two@x.com", email: "Ian.Two@x.com" },
      { id: "s1", firstName: "Sam", lastName: "Shop", name: "Sam Shop", email: "sam@x.com" },
    ],
    roleRows: [],
    memberships: [],
    branches: [
      { id: "shop1", name: "Main", branchType: "shop", ownerUserId: null, isDefault: true, isActive: true },
    ],
    clients: [],
    transactions: [],
    tasks: [],
    legacyTasks: [],
    tickets: [],
    notes: [],
    agentTargets: [],
    entityLinks: [],
    multiOrgUserIds: [],
    ...over,
  };
}

const hwRole = (userId: string, id = `r-${userId}`) => ({ id, userId, role: "homeworker" });
const activeMember = (userId: string, branchId: string, id = `m-${userId}-${branchId}`, orgRole = "homeworker") => ({
  id,
  userId,
  branchId,
  orgRole,
  isActive: true,
});
const ops = (plan: { operations: PlanOperation[] }, type: PlanOperation["type"]) =>
  plan.operations.filter((o) => o.type === type);
const byType = <T extends PlanOperation["type"]>(plan: { operations: PlanOperation[] }, type: T) =>
  plan.operations.filter((o): o is Extract<PlanOperation, { type: T }> => o.type === type);
const setBranch = (plan: { operations: PlanOperation[] }, table: string, ref?: string) =>
  byType(plan, "set_branch")
    .filter((o) => o.table === table && (ref === undefined || o.branchRef === ref))
    .flatMap((o) => o.ids);

const legacyBranch = {
  id: "legacy",
  name: "Homeworkers",
  branchType: "homeworker" as const,
  ownerUserId: null,
  isDefault: false,
  isActive: true,
};

describe("simple homeworker", () => {
  const data = input({
    roleRows: [hwRole("h1")],
    memberships: [activeMember("h1", "legacy", "m1")],
    branches: [...input().branches, legacyBranch],
    clients: [{ id: "c1", createdBy: "h1", branchId: "legacy" }],
    transactions: [{ id: "t1", userId: "h1", branchId: "legacy", clientId: "c1" }],
    tasks: [
      { id: "k1", userId: "h1", branchId: "legacy", entityType: "booking", entityId: "bk1" },
      { id: "k2", userId: "s1", branchId: "shop1", entityType: "quote", entityId: "q1" },
      { id: "k3", userId: "s1", branchId: "shop1", entityType: "quote", entityId: "q-other" },
    ],
    entityLinks: [
      { entityType: "quote", entityId: "q1", transactionId: "t1" },
      { entityType: "booking", entityId: "bk1", transactionId: "t1" },
    ],
    legacyTasks: [{ id: "lk1", userId: null, branchId: "legacy", transactionId: "t1", clientId: null }],
    tickets: [
      { id: "tk1", userId: "s1", branchId: "shop1", transactionId: "t1", clientId: null },
      { id: "tk2", userId: "s1", branchId: "shop1", transactionId: null, clientId: "c1" },
      { id: "tk3", userId: "h1", branchId: "legacy", transactionId: null, clientId: null },
      { id: "tk4", userId: "s1", branchId: "shop1", transactionId: null, clientId: null },
    ],
    agentTargets: [{ id: "a1", userId: "h1", branchId: "legacy", year: 2026, month: 5 }],
  });
  const plan = planOrgMigration(data);

  it("creates one homeworker branch with the org default share and NO contact fields", () => {
    expect(byType(plan, "create_branch")).toEqual([
      { type: "create_branch", ref: newBranchRef("h1"), ownerUserId: "h1", name: "Hannah Hart", profitSharePercent: 60 },
    ]);
  });

  it("rewrites branch_id on the homeworker rows and the rows following their deals", () => {
    const ref = newBranchRef("h1");
    expect(setBranch(plan, "client_table", ref)).toEqual(["c1"]);
    expect(setBranch(plan, "transaction", ref)).toEqual(["t1"]);
    expect(setBranch(plan, "tasks", ref)).toEqual(["k1", "k2"]);
    expect(setBranch(plan, "task", ref)).toEqual(["lk1"]);
    expect(setBranch(plan, "tickets", ref)).toEqual(["tk1", "tk2", "tk3"]);
    expect(setBranch(plan, "agent_target_table", ref)).toEqual(["a1"]);
    expect(plan.report.branchRewrites).toMatchObject({ client_table: 1, transaction: 1, tasks: 2, task: 1, tickets: 3, agent_target_table: 1 });
  });

  it("moves the membership, sets the legacy user.org_role and archives the legacy branch last", () => {
    expect(byType(plan, "delete_memberships")[0].membershipIds).toEqual(["m1"]);
    expect(byType(plan, "insert_membership")).toEqual([
      { type: "insert_membership", userId: "h1", branchRef: newBranchRef("h1"), orgRole: "homeworker", isActive: true },
    ]);
    expect(byType(plan, "set_user_org_role")).toEqual([{ type: "set_user_org_role", userId: "h1", orgRole: "homeworker" }]);
    expect(plan.operations[plan.operations.length - 1]).toEqual({ type: "archive_branch", branchId: "legacy" });
  });

  it("has no blocking conflicts and no splits", () => {
    expect(blockingConflicts(plan.report)).toEqual([]);
    expect(plan.report.clientSplits).toEqual([]);
  });

  it("orders branch creation before membership and rewrites", () => {
    const idx = (t: PlanOperation["type"]) => plan.operations.findIndex((o) => o.type === t);
    expect(idx("create_branch")).toBeLessThan(idx("insert_membership"));
    expect(idx("create_branch")).toBeLessThan(idx("set_branch"));
  });
});

describe("branch names (S5)", () => {
  it("uses the email placeholder when first/last are empty and the display name is the email", () => {
    const plan = planOrgMigration(input({ roleRows: [hwRole("h2")] }));
    expect(byType(plan, "create_branch")[0].name).toBe("ian.two");
  });
  it("prefers a real full name, ignoring the invite placeholder last name", () => {
    const u = { id: "x", firstName: "Ann", lastName: "—", name: "Ann", email: "ann@x.com" };
    expect(homeworkerBranchName(u, "x")).toBe("Ann");
  });
  it("uses a real display name when the first/last names are empty", () => {
    expect(homeworkerBranchName({ id: "x", firstName: "", lastName: "", name: "Ann Lee", email: "a@x.com" }, "x")).toBe("Ann Lee");
  });
  it("falls back to the user id when nothing is known", () => {
    expect(homeworkerBranchName(undefined, "x")).toBe("x");
  });
  it("uses a null share when the org has no default or it is out of range", () => {
    for (const v of [null, 150, -1]) {
      const plan = planOrgMigration(input({ org: { id: "o1", homeworkerCommission: v }, roleRows: [hwRole("h1")] }));
      expect(byType(plan, "create_branch")[0].profitSharePercent).toBeNull();
    }
  });
});

describe("membership state is carried over (B1)", () => {
  it("inserts the new membership active when they had an active one", () => {
    const plan = planOrgMigration(input({ roleRows: [hwRole("h1")], memberships: [activeMember("h1", "shop1", "m1")] }));
    expect(byType(plan, "insert_membership")[0].isActive).toBe(true);
    expect(plan.report.inactiveHomeworkers).toEqual([]);
  });

  it("inserts it inactive when every old membership was inactive, and reports it", () => {
    const plan = planOrgMigration(
      input({
        roleRows: [hwRole("h1")],
        memberships: [{ id: "m1", userId: "h1", branchId: "shop1", orgRole: "homeworker", isActive: false }],
      }),
    );
    expect(byType(plan, "insert_membership")[0].isActive).toBe(false);
    expect(plan.report.inactiveHomeworkers).toEqual([{ userId: "h1", reason: "inactive_membership" }]);
    expect(informationalConflicts(plan.report).map((c) => c.kind)).toContain("inactive_homeworker_carried_over");
  });

  it("inserts it inactive when they had no membership at all", () => {
    const plan = planOrgMigration(input({ roleRows: [hwRole("h1")] }));
    expect(byType(plan, "insert_membership")[0].isActive).toBe(false);
    expect(plan.report.inactiveHomeworkers).toEqual([{ userId: "h1", reason: "no_membership" }]);
  });

  it("an inactive homeworker membership alone still counts as a homeworker", () => {
    const plan = planOrgMigration(
      input({ memberships: [{ id: "m", userId: "h2", branchId: "shop1", orgRole: "homeworker", isActive: false }] }),
    );
    expect(byType(plan, "create_branch")).toHaveLength(1);
    expect(byType(plan, "insert_role_row")).toEqual([{ type: "insert_role_row", userId: "h2", role: "homeworker" }]);
  });
});

describe("homeworker sitting in a shop branch", () => {
  const plan = planOrgMigration(input({ roleRows: [hwRole("h1")], memberships: [activeMember("h1", "shop1", "m1")] }));

  it("reports it informationally and removes the shop membership", () => {
    expect(plan.report.homeworkersInShopBranches).toEqual([{ userId: "h1", branchId: "shop1", branchName: "Main" }]);
    expect(byType(plan, "delete_memberships")[0].membershipIds).toEqual(["m1"]);
    expect(informationalConflicts(plan.report).map((c) => c.kind)).toContain("homeworker_in_shop_branch");
    expect(blockingConflicts(plan.report)).toEqual([]);
  });
});

describe("extra roles (B2)", () => {
  it("deletes only agent and social_media_manager rows (homeworker wins) and reports it informationally", () => {
    const plan = planOrgMigration(
      input({
        roleRows: [
          hwRole("h1"),
          { id: "ra", userId: "h1", role: "agent" },
          { id: "rs", userId: "h1", role: "social_media_manager" },
          { id: "rx", userId: "s1", role: "agent" },
        ],
      }),
    );
    expect(byType(plan, "delete_role_rows")).toEqual([
      { type: "delete_role_rows", userId: "h1", roleRowIds: ["ra", "rs"], roles: ["agent", "social_media_manager"] },
    ]);
    expect(informationalConflicts(plan.report).map((c) => c.kind)).toContain("extra_roles_removed");
    expect(blockingConflicts(plan.report)).toEqual([]);
  });

  for (const role of ["org_admin", "branch_manager"]) {
    it(`a homeworker who is also ${role} is skipped entirely with a blocking conflict`, () => {
      const plan = planOrgMigration(
        input({
          roleRows: [hwRole("h1"), { id: "rb", userId: "h1", role }],
          memberships: [activeMember("h1", "shop1", "m1")],
          clients: [{ id: "c1", createdBy: "h1", branchId: "shop1" }],
          transactions: [{ id: "t1", userId: "h1", branchId: "shop1", clientId: "c1" }],
        }),
      );
      expect(plan.operations).toEqual([]);
      expect(plan.report.skippedUsers).toEqual([{ userId: "h1", reason: "admin_or_manager_role" }]);
      expect(blockingConflicts(plan.report).map((c) => c.kind)).toEqual(["admin_or_manager_role"]);
    });
  }

  it("a sole org_admin who is also a homeworker is skipped and nobody's role rows are deleted", () => {
    const plan = planOrgMigration(
      input({
        roleRows: [hwRole("h1"), { id: "ro", userId: "h1", role: "org_admin" }, { id: "ra", userId: "h1", role: "agent" }],
      }),
    );
    expect(ops(plan, "delete_role_rows")).toHaveLength(0);
    expect(ops(plan, "create_branch")).toHaveLength(0);
  });

  it("an org_admin membership (no role row) also blocks", () => {
    const plan = planOrgMigration(
      input({ roleRows: [hwRole("h1")], memberships: [activeMember("h1", "shop1", "m1", "org_admin")] }),
    );
    expect(plan.report.skippedUsers[0].reason).toBe("admin_or_manager_role");
  });
});

describe("multi-org homeworker (S6)", () => {
  it("is skipped with a blocking conflict", () => {
    const plan = planOrgMigration(input({ roleRows: [hwRole("h1"), hwRole("h2")], multiOrgUserIds: ["h1"] }));
    expect(plan.report.skippedUsers).toEqual([{ userId: "h1", reason: "multi_org_owner" }]);
    expect(blockingConflicts(plan.report).map((c) => c.kind)).toEqual(["multi_org_owner"]);
    expect(byType(plan, "create_branch").map((o) => o.ownerUserId)).toEqual(["h2"]);
  });
});

describe("two homeworkers sharing a client (S13: original stays with the creator)", () => {
  const data = input({
    roleRows: [hwRole("h1"), hwRole("h2")],
    clients: [{ id: "c1", createdBy: "h1", branchId: "shop1" }],
    transactions: [
      { id: "t1", userId: "h1", branchId: "shop1", clientId: "c1" },
      { id: "t2", userId: "h2", branchId: "shop1", clientId: "c1" },
    ],
    tasks: [{ id: "k2", userId: "h2", branchId: "shop1", entityType: "client", entityId: "c1" }],
    legacyTasks: [
      { id: "lk2", userId: "h2", branchId: "shop1", transactionId: null, clientId: "c1" },
      // linked to h2's deal but holds no client id: follows the deal, is not re-pointed.
      { id: "lk3", userId: "h2", branchId: "shop1", transactionId: "t2", clientId: null },
    ],
    tickets: [{ id: "tk2", userId: "h2", branchId: "shop1", transactionId: "t2", clientId: "c1" }],
    notes: [
      { id: "n1", userId: "h1", agentId: null, transactionId: null, clientId: "c1" },
      { id: "n2", userId: "h2", agentId: null, transactionId: "t2", clientId: "c1" },
      { id: "n3", userId: "h2", agentId: null, transactionId: "t2", clientId: null },
    ],
  });
  const plan = planOrgMigration(data);
  const copyRef = newClientRef("h2", "c1");

  it("keeps the original with its creator and copies it for the other homeworker", () => {
    expect(byType(plan, "create_client_copy")).toEqual([
      { type: "create_client_copy", ref: copyRef, originalClientId: "c1", createdBy: "h2", resetFields: CLIENT_COPY_RESET_FIELDS, branchRef: newBranchRef("h2") },
    ]);
    expect(setBranch(plan, "client_table", newBranchRef("h1"))).toEqual(["c1"]);
  });

  it("re-points only rows whose client column equals the original (S10)", () => {
    const repoints = byType(plan, "set_client");
    const get = (table: string) => repoints.find((o) => o.table === table)?.ids;
    expect(get("transaction")).toEqual(["t2"]);
    expect(get("task")).toEqual(["lk2"]);
    expect(get("tasks")).toEqual(["k2"]);
    expect(get("tickets")).toEqual(["tk2"]);
    expect(get("notes")).toEqual(["n2"]);
    expect(repoints.every((o) => o.clientRef === copyRef && o.fromClientId === "c1")).toBe(true);
    expect(plan.report.clientSplits[0].counts).toEqual({ transactions: 1, tasks: 1, legacyTasks: 1, tickets: 1, notes: 1 });
  });

  it("the unlinked legacy task follows its deal to the second homeworker branch", () => {
    expect(setBranch(plan, "task", newBranchRef("h2"))).toEqual(expect.arrayContaining(["lk2", "lk3"]));
  });

  it("creates the copy before it is referenced and reports the split as informational", () => {
    const copyIdx = plan.operations.findIndex((o) => o.type === "create_client_copy");
    const refIdx = plan.operations.findIndex((o) => o.type === "set_client");
    expect(copyIdx).toBeLessThan(refIdx);
    expect(informationalConflicts(plan.report).filter((c) => c.kind === "client_split")).toHaveLength(1);
    expect(blockingConflicts(plan.report)).toEqual([]);
  });
});

describe("move versus copy (B3)", () => {
  it("moves a shop-created client when only the homeworker has deals on it (created_by kept)", () => {
    const plan = planOrgMigration(
      input({
        roleRows: [hwRole("h1")],
        clients: [{ id: "c1", createdBy: "s1", branchId: "shop1" }],
        transactions: [{ id: "t1", userId: "h1", branchId: "shop1", clientId: "c1" }],
      }),
    );
    expect(ops(plan, "create_client_copy")).toHaveLength(0);
    expect(ops(plan, "set_client")).toHaveLength(0);
    expect(setBranch(plan, "client_table", newBranchRef("h1"))).toEqual(["c1"]);
    expect(plan.report.clientMoves).toEqual([{ clientId: "c1", userId: "h1" }]);
    expect(informationalConflicts(plan.report).map((c) => c.kind)).toContain("client_moved");
  });

  it("copies when shop staff also have deals on the client; the original stays in the shop", () => {
    const plan = planOrgMigration(
      input({
        roleRows: [hwRole("h1")],
        clients: [{ id: "c1", createdBy: "s1", branchId: "shop1" }],
        transactions: [
          { id: "t1", userId: "h1", branchId: "shop1", clientId: "c1" },
          { id: "t9", userId: "s1", branchId: "shop1", clientId: "c1" },
        ],
      }),
    );
    expect(byType(plan, "create_client_copy")).toHaveLength(1);
    expect(setBranch(plan, "client_table")).toEqual([]);
    expect(byType(plan, "set_client")[0]).toMatchObject({ table: "transaction", ids: ["t1"] });
    expect(byType(plan, "set_client").flatMap((o) => o.ids)).not.toContain("t9");
  });

  it("copies (never moves) when the creator is another homeworker, even if only one has deals", () => {
    const plan = planOrgMigration(
      input({
        roleRows: [hwRole("h1"), hwRole("h2")],
        clients: [{ id: "c1", createdBy: "h1", branchId: "shop1" }],
        transactions: [{ id: "t2", userId: "h2", branchId: "shop1", clientId: "c1" }],
      }),
    );
    expect(byType(plan, "create_client_copy")).toHaveLength(1);
    expect(setBranch(plan, "client_table", newBranchRef("h1"))).toEqual(["c1"]);
  });

  it("gives the shop side a copy of a homeworker-created client", () => {
    const plan = planOrgMigration(
      input({
        roleRows: [hwRole("h1")],
        clients: [{ id: "c1", createdBy: "h1", branchId: "shop1" }],
        transactions: [{ id: "t9", userId: "s1", branchId: "shop1", clientId: "c1" }],
      }),
    );
    expect(byType(plan, "create_client_copy")).toEqual([
      { type: "create_client_copy", ref: newClientRef("s1", "c1"), originalClientId: "c1", createdBy: "s1", resetFields: CLIENT_COPY_RESET_FIELDS, branchRef: "shop1" },
    ]);
    expect(plan.report.clientSplits[0].side).toBe("shop");
  });

  it("never copies or moves a merged client, and follows mergedIntoId to the active one", () => {
    const plan = planOrgMigration(
      input({
        roleRows: [hwRole("h1")],
        clients: [
          { id: "old", createdBy: "s1", branchId: "shop1", status: "merged", mergedIntoId: "c1" },
          { id: "c1", createdBy: "s1", branchId: "shop1" },
        ],
        transactions: [
          { id: "t1", userId: "h1", branchId: "shop1", clientId: "old" },
          { id: "t9", userId: "s1", branchId: "shop1", clientId: "c1" },
        ],
      }),
    );
    expect(byType(plan, "create_client_copy").map((c) => c.originalClientId)).toEqual(["c1"]);
    expect(byType(plan, "set_client")[0]).toMatchObject({ ids: ["t1"], fromClientId: "old" });
  });

  it("ignores a merged client with no active target", () => {
    const plan = planOrgMigration(
      input({
        roleRows: [hwRole("h1")],
        clients: [{ id: "old", createdBy: "s1", branchId: "shop1", status: "merged", mergedIntoId: null }],
        transactions: [{ id: "t1", userId: "h1", branchId: "shop1", clientId: "old" }],
      }),
    );
    expect(ops(plan, "create_client_copy")).toHaveLength(0);
    expect(plan.report.clientMoves).toEqual([]);
  });
});

describe("ticket and task precedence (S1)", () => {
  it("a homeworker-raised ticket on a shop deal stays with the shop", () => {
    const plan = planOrgMigration(
      input({
        roleRows: [hwRole("h1")],
        clients: [{ id: "c1", createdBy: "s1", branchId: "shop1" }],
        transactions: [{ id: "t9", userId: "s1", branchId: "shop1", clientId: "c1" }],
        tickets: [{ id: "tk1", userId: "h1", branchId: "shop1", transactionId: "t9", clientId: "c1" }],
      }),
    );
    expect(setBranch(plan, "tickets")).toEqual([]);
  });

  it("a shop ticket on a homeworker deal follows the deal", () => {
    const plan = planOrgMigration(
      input({
        roleRows: [hwRole("h1")],
        transactions: [{ id: "t1", userId: "h1", branchId: "shop1", clientId: null }],
        tickets: [{ id: "tk1", userId: "s1", branchId: "shop1", transactionId: "t1", clientId: null }],
      }),
    );
    expect(setBranch(plan, "tickets", newBranchRef("h1"))).toEqual(["tk1"]);
  });

  it("the deal decides before the client or creator, whatever the id order", () => {
    for (const [a, b] of [["h1", "h2"], ["h2", "h1"]] as const) {
      for (const ids of [["tkA", "tkZ"], ["tkZ", "tkA"]]) {
        const plan = planOrgMigration(
          input({
            roleRows: [hwRole(a), hwRole(b)],
            clients: [{ id: "c9", createdBy: b, branchId: "shop1" }],
            transactions: [{ id: "t1", userId: a, branchId: "shop1", clientId: null }],
            tickets: [
              // raised by b on a client b created, but linked to a's deal: a's deal wins
              { id: ids[0], userId: b, branchId: "shop1", transactionId: "t1", clientId: "c9" },
              // no deal: the client (created by b) decides before the creator
              { id: ids[1], userId: a, branchId: "shop1", transactionId: null, clientId: "c9" },
            ],
          }),
        );
        expect(setBranch(plan, "tickets", newBranchRef(a))).toEqual([ids[0]]);
        expect(setBranch(plan, "tickets", newBranchRef(b))).toEqual([ids[1]]);
      }
    }
  });

  it("a row re-pointed to a copy follows the copy's side, not the creator's", () => {
    const plan = planOrgMigration(
      input({
        roleRows: [hwRole("h1"), hwRole("h2")],
        clients: [{ id: "c1", createdBy: "h1", branchId: "shop1" }],
        transactions: [{ id: "t2", userId: "h2", branchId: "shop1", clientId: "c1" }],
        tickets: [{ id: "tk1", userId: "h2", branchId: "shop1", transactionId: null, clientId: "c1" }],
      }),
    );
    expect(setBranch(plan, "tickets", newBranchRef("h2"))).toEqual(["tk1"]);
    expect(setBranch(plan, "tickets", newBranchRef("h1"))).toEqual([]);
  });

  it("the creator arm applies only when nothing else decided", () => {
    const plan = planOrgMigration(
      input({
        roleRows: [hwRole("h1")],
        tickets: [{ id: "tk3", userId: "h1", branchId: "shop1", transactionId: null, clientId: null }],
      }),
    );
    expect(setBranch(plan, "tickets", newBranchRef("h1"))).toEqual(["tk3"]);
  });
});

describe("tasks link through quote/enquiry/booking (S2)", () => {
  it("resolves a quote task through its transaction", () => {
    const plan = planOrgMigration(
      input({
        roleRows: [hwRole("h1")],
        transactions: [{ id: "t1", userId: "h1", branchId: "shop1", clientId: null }],
        tasks: [
          { id: "k1", userId: "s1", branchId: "shop1", entityType: "quote", entityId: "q1" },
          { id: "k2", userId: "s1", branchId: "shop1", entityType: "enquiry", entityId: "e1" },
          { id: "k3", userId: "s1", branchId: "shop1", entityType: "booking", entityId: "b-unknown" },
        ],
        entityLinks: [
          { entityType: "quote", entityId: "q1", transactionId: "t1" },
          { entityType: "enquiry", entityId: "e1", transactionId: "t1" },
        ],
      }),
    );
    expect(setBranch(plan, "tasks", newBranchRef("h1"))).toEqual(["k1", "k2"]);
  });

  it("never treats a quote entity id as a client id", () => {
    const plan = planOrgMigration(
      input({
        roleRows: [hwRole("h1")],
        clients: [{ id: "same-id", createdBy: "h1", branchId: "shop1" }],
        tasks: [{ id: "k1", userId: "s1", branchId: "shop1", entityType: "quote", entityId: "same-id" }],
      }),
    );
    expect(setBranch(plan, "tasks")).toEqual([]);
  });

  it("treats entityType client as a client link", () => {
    const plan = planOrgMigration(
      input({
        roleRows: [hwRole("h1")],
        clients: [{ id: "c1", createdBy: "h1", branchId: "shop1" }],
        tasks: [{ id: "k1", userId: "s1", branchId: "shop1", entityType: "client", entityId: "c1" }],
      }),
    );
    expect(setBranch(plan, "tasks", newBranchRef("h1"))).toEqual(["k1"]);
  });
});

describe("rows with a NULL org (S7)", () => {
  it("includes them and asks the runner to fill the org id", () => {
    const plan = planOrgMigration(
      input({
        roleRows: [hwRole("h1")],
        clients: [
          { id: "c1", createdBy: "h1", branchId: null, orgId: null },
          { id: "c2", createdBy: "h1", branchId: "shop1", orgId: "o1" },
        ],
        transactions: [{ id: "t1", userId: "h1", branchId: null, clientId: "c1", orgId: null }],
        tickets: [{ id: "tk1", userId: "h1", branchId: null, transactionId: "t1", clientId: null, orgId: null }],
      }),
    );
    const clientOp = byType(plan, "set_branch").find((o) => o.table === "client_table");
    expect(clientOp?.ids).toEqual(["c1", "c2"]);
    expect(clientOp?.fillOrgIds).toEqual(["c1"]);
    expect(byType(plan, "set_branch").find((o) => o.table === "transaction")?.fillOrgIds).toEqual(["t1"]);
    expect(byType(plan, "set_branch").find((o) => o.table === "tickets")?.fillOrgIds).toEqual(["tk1"]);
  });
});

describe("homeworker already migrated", () => {
  const migrated = () =>
    input({
      roleRows: [hwRole("h1")],
      memberships: [activeMember("h1", "hb1", "m1")],
      branches: [
        ...input().branches,
        { id: "hb1", name: "Hannah Hart", branchType: "homeworker", ownerUserId: "h1", isDefault: false, isActive: true },
      ],
      clients: [{ id: "c1", createdBy: "h1", branchId: "hb1" }],
      transactions: [{ id: "t1", userId: "h1", branchId: "hb1", clientId: "c1" }],
    });

  it("is a no-op", () => {
    const plan = planOrgMigration(migrated());
    expect(plan.operations).toEqual([]);
    expect(plan.report.alreadyMigrated).toEqual(["h1"]);
    expect(plan.report.conflicts).toEqual([]);
  });

  it("is deterministic", () => {
    expect(planOrgMigration(migrated())).toEqual(planOrgMigration(migrated()));
  });
});

describe("orgs without homeworkers (S11)", () => {
  it("orgHasHomeworkers is false with no homeworker role rows or memberships", () => {
    expect(orgHasHomeworkers({ roleRows: [{ id: "r", userId: "s1", role: "agent" }], memberships: [activeMember("s1", "shop1", "m", "agent")] })).toBe(false);
    expect(orgHasHomeworkers({ roleRows: [hwRole("h1")], memberships: [] })).toBe(true);
    expect(orgHasHomeworkers({ roleRows: [], memberships: [activeMember("h1", "shop1")] })).toBe(true);
  });

  it("plans nothing for an org with no homeworkers", () => {
    const plan = planOrgMigration(input({ clients: [{ id: "c1", createdBy: "s1", branchId: "shop1" }] }));
    expect(plan.operations).toEqual([]);
  });
});

describe("agent targets", () => {
  const plan = planOrgMigration(
    input({
      roleRows: [hwRole("h1")],
      agentTargets: [
        { id: "a1", userId: "h1", branchId: "shop1", year: 2026, month: 5, targetAmount: "1000.00", updatedAtMs: 100 },
        { id: "a2", userId: "h1", branchId: "legacy", year: 2026, month: 5, targetAmount: "1500.00", updatedAtMs: 200 },
        { id: "a3", userId: "h1", branchId: "shop1", year: 2026, month: 6, targetAmount: "700.00", updatedAtMs: 50 },
        { id: "a4", userId: "s1", branchId: "shop1", year: 2026, month: 5, targetAmount: "9.00", updatedAtMs: 1 },
      ],
    }),
  );

  it("keeps the newest duplicate, reports amounts and blocks", () => {
    expect(setBranch(plan, "agent_target_table")).toEqual(["a2", "a3"]);
    expect(plan.report.agentTargetsSkipped).toEqual([
      { id: "a1", userId: "h1", year: 2026, month: 5, amount: "1000.00", keptId: "a2", keptAmount: "1500.00" },
    ]);
    expect(blockingConflicts(plan.report).map((c) => c.kind)).toEqual(["agent_target_conflict"]);
    expect(blockingConflicts(plan.report)[0].message).toContain("1500.00");
  });

  it("leaves other users targets alone", () => {
    expect(setBranch(plan, "agent_target_table")).not.toContain("a4");
  });
});

describe("legacy shared branch (S12)", () => {
  const legacy = { ...legacyBranch };

  it("archives only after every homeworker operation", () => {
    const plan = planOrgMigration(
      input({
        branches: [...input().branches, legacy],
        roleRows: [hwRole("h1"), hwRole("h2")],
        memberships: [activeMember("h1", "legacy", "m1"), activeMember("h2", "legacy", "m2")],
      }),
    );
    expect(plan.operations[plan.operations.length - 1]).toEqual({ type: "archive_branch", branchId: "legacy" });
    const lastMembership = plan.operations.map((o) => o.type).lastIndexOf("insert_membership");
    expect(plan.operations.length - 1).toBeGreaterThan(lastMembership);
  });

  it("blocks the archive when it is the org default", () => {
    const plan = planOrgMigration(
      input({
        branches: [{ ...input().branches[0], isDefault: false }, { ...legacy, isDefault: true }],
        roleRows: [hwRole("h1")],
        memberships: [activeMember("h1", "legacy", "m1")],
      }),
    );
    expect(ops(plan, "archive_branch")).toHaveLength(0);
    expect(blockingConflicts(plan.report).map((c) => c.kind)).toEqual(["legacy_branch_is_default"]);
  });

  it("blocks the archive while a non-migrated member remains", () => {
    const plan = planOrgMigration(
      input({
        branches: [...input().branches, legacy],
        roleRows: [hwRole("h1")],
        memberships: [activeMember("h1", "legacy", "m1"), activeMember("s1", "legacy", "m3", "agent")],
      }),
    );
    expect(ops(plan, "archive_branch")).toHaveLength(0);
    expect(plan.report.legacyBranchesBlocked[0]).toMatchObject({ branchId: "legacy", remainingMemberIds: ["s1"] });
    expect(blockingConflicts(plan.report).map((c) => c.kind)).toEqual(["legacy_branch_not_archivable"]);
  });

  it("re-homes residue rows to the default shop branch and reports them informationally", () => {
    const plan = planOrgMigration(
      input({
        branches: [...input().branches, legacy],
        roleRows: [hwRole("h1")],
        memberships: [activeMember("h1", "legacy", "m1")],
        clients: [
          { id: "c1", createdBy: "h1", branchId: "legacy" },
          { id: "c9", createdBy: "s1", branchId: "legacy" },
        ],
        transactions: [
          { id: "t1", userId: "h1", branchId: "legacy", clientId: "c1" },
          { id: "t9", userId: "s1", branchId: "legacy", clientId: "c9", orgId: null },
        ],
      }),
    );
    expect(setBranch(plan, "client_table", "shop1")).toEqual(["c9"]);
    expect(setBranch(plan, "transaction", "shop1")).toEqual(["t9"]);
    expect(byType(plan, "set_branch").find((o) => o.branchRef === "shop1" && o.table === "transaction")?.fillOrgIds).toEqual(["t9"]);
    expect(plan.report.legacyBranchResidue[0]).toMatchObject({ branchId: "legacy", counts: { clients: 1, transactions: 1 }, reassignedTo: "shop1" });
    expect(informationalConflicts(plan.report).map((c) => c.kind)).toContain("legacy_branch_residue");
    // residue moves happen before the archive
    const archiveIdx = plan.operations.findIndex((o) => o.type === "archive_branch");
    const residueIdx = plan.operations.findIndex((o) => o.type === "set_branch" && o.branchRef === "shop1");
    expect(residueIdx).toBeLessThan(archiveIdx);
  });

  it("blocks when there is no shop branch to take the residue", () => {
    const plan = planOrgMigration(
      input({
        branches: [legacy],
        roleRows: [hwRole("h1")],
        memberships: [activeMember("h1", "legacy", "m1")],
        clients: [{ id: "c9", createdBy: "s1", branchId: "legacy" }],
      }),
    );
    expect(ops(plan, "archive_branch")).toHaveLength(0);
    expect(blockingConflicts(plan.report).map((c) => c.kind)).toEqual(["no_default_shop_branch"]);
  });

  it("ignores inactive members, skips archived branches and never archives an owned one", () => {
    const plan = planOrgMigration(
      input({
        branches: [
          ...input().branches,
          legacy,
          { ...legacy, id: "old", isActive: false },
          { ...legacy, id: "hb1", ownerUserId: "h1" },
        ],
        memberships: [{ id: "m3", userId: "s1", branchId: "legacy", orgRole: "agent", isActive: false }],
      }),
    );
    expect(byType(plan, "archive_branch")).toEqual([{ type: "archive_branch", branchId: "legacy" }]);
  });
});

describe("severity split (S8)", () => {
  it("classifies every kind as blocking or informational", () => {
    const plan = planOrgMigration(
      input({
        branches: [...input().branches, legacyBranch],
        roleRows: [hwRole("h1"), { id: "ra", userId: "h1", role: "agent" }],
        memberships: [activeMember("h1", "shop1", "m1")],
      }),
    );
    expect(blockingConflicts(plan.report)).toEqual([]);
    expect(informationalConflicts(plan.report).map((c) => c.kind).sort()).toEqual(["extra_roles_removed", "homeworker_in_shop_branch"]);
  });
});

describe("RowAssignments", () => {
  it("first writer wins and reports a different later target", () => {
    const a = new RowAssignments();
    expect(a.assign("tickets", "t1", "b1")).toBe(true);
    expect(a.assign("tickets", "t1", "b1")).toBe(true);
    expect(a.assign("tickets", "t1", "b2")).toBe(false);
    expect(a.get("tickets", "t1")).toBe("b1");
    expect(a.get("tickets", "other")).toBeUndefined();
  });
});

describe("exact operation sequence for a mixed scenario", () => {
  const data = input({
    branches: [...input().branches, legacyBranch],
    roleRows: [hwRole("h1"), { id: "ra", userId: "h1", role: "agent" }],
    memberships: [
      activeMember("h1", "legacy", "m1"),
      { id: "m2", userId: "h2", branchId: "legacy", orgRole: "homeworker", isActive: false },
    ],
    clients: [
      { id: "c1", createdBy: "h1", branchId: "legacy" },
      { id: "c2", createdBy: "s1", branchId: "shop1" },
      { id: "c3", createdBy: "s1", branchId: "shop1" },
    ],
    transactions: [
      { id: "t1", userId: "h1", branchId: "legacy", clientId: "c1" },
      { id: "t2", userId: "h2", branchId: "shop1", clientId: "c2" },
      { id: "t3", userId: "h1", branchId: "shop1", clientId: "c3" },
      { id: "t4", userId: "s1", branchId: "shop1", clientId: "c3" },
    ],
    agentTargets: [{ id: "a1", userId: "h1", branchId: "legacy", year: 2026, month: 5 }],
  });

  it("matches the documented order", () => {
    const plan = planOrgMigration(data);
    const h1 = newBranchRef("h1");
    const h2 = newBranchRef("h2");
    expect(plan.operations).toEqual([
      { type: "delete_role_rows", userId: "h1", roleRowIds: ["ra"], roles: ["agent"] },
      { type: "create_branch", ref: h1, ownerUserId: "h1", name: "Hannah Hart", profitSharePercent: 60 },
      { type: "delete_memberships", userId: "h1", membershipIds: ["m1"] },
      { type: "insert_membership", userId: "h1", branchRef: h1, orgRole: "homeworker", isActive: true },
      { type: "set_user_org_role", userId: "h1", orgRole: "homeworker" },
      { type: "create_client_copy", ref: newClientRef("h1", "c3"), originalClientId: "c3", createdBy: "h1", resetFields: CLIENT_COPY_RESET_FIELDS, branchRef: h1 },
      { type: "set_client", table: "transaction", ids: ["t3"], fromClientId: "c3", clientRef: newClientRef("h1", "c3") },
      { type: "set_branch", table: "client_table", ids: ["c1"], branchRef: h1, fillOrgIds: [] },
      { type: "set_branch", table: "transaction", ids: ["t1", "t3"], branchRef: h1, fillOrgIds: [] },
      { type: "set_branch", table: "agent_target_table", ids: ["a1"], branchRef: h1, fillOrgIds: [] },
      { type: "insert_role_row", userId: "h2", role: "homeworker" },
      { type: "create_branch", ref: h2, ownerUserId: "h2", name: "ian.two", profitSharePercent: 60 },
      { type: "delete_memberships", userId: "h2", membershipIds: ["m2"] },
      { type: "insert_membership", userId: "h2", branchRef: h2, orgRole: "homeworker", isActive: false },
      { type: "set_user_org_role", userId: "h2", orgRole: "homeworker" },
      { type: "set_branch", table: "client_table", ids: ["c2"], branchRef: h2, fillOrgIds: [] },
      { type: "set_branch", table: "transaction", ids: ["t2"], branchRef: h2, fillOrgIds: [] },
      { type: "archive_branch", branchId: "legacy" },
    ]);
  });
});

describe("branch_id column review and report", () => {
  const plan = planOrgMigration(input({ roleRows: [hwRole("h1")] }));

  it("lists every branch_id column from the schema with a decision", () => {
    const tables = plan.report.branchIdColumnsReviewed.map((r) => r.table).sort();
    expect(tables).toEqual(
      [
        "agent_target_table", "branch_members", "client_merge_log", "client_table", "forwards_report",
        "homeworker_payout_statement", "notes", "shop_target_table", "task", "tasks", "tickets",
        "training_course", "transaction",
      ].sort(),
    );
  });

  it("formats a readable report with blocking and informational sections", () => {
    const text = formatReport(plan.report);
    expect(text).toContain("Organization o1");
    expect(text).toContain("Homeworkers found: 1");
    expect(text).toContain("BLOCKING conflicts: 0");
    expect(text).toContain("Informational:");
    expect(text).toContain("Suspended/pending homeworkers");
  });
});

describe("planClientSplit (reusable helper)", () => {
  it("plans a copy and repoints for one user's rows only, grouped by the id they hold", () => {
    const result = planClientSplit({ id: "c1", createdBy: "s1", branchId: "shop1" }, "h1", "hb1", {
      transactions: [{ id: "t1", userId: "h1", branchId: null, clientId: "c1" }],
      tasks: [],
      legacyTasks: [{ id: "lk", userId: "h1", branchId: null, transactionId: null, clientId: "c1" }],
      tickets: [],
      notes: [{ id: "n", userId: "h1", agentId: null, transactionId: null, clientId: "c1" }],
    });
    expect(result.copy).toMatchObject({ ref: "new-client:h1:c1", originalClientId: "c1", createdBy: "h1", branchRef: "hb1" });
    expect(result.repoints.map((r) => r.table)).toEqual(["transaction", "task", "notes"]);
    expect(result.counts).toEqual({ transactions: 1, tasks: 0, legacyTasks: 1, tickets: 0, notes: 1 });
  });

  it("resets portal, referral, VIP and merge fields on the copy", () => {
    const { copy } = planClientSplit({ id: "c1", createdBy: "s1", branchId: "shop1" }, "h1", "hb1", {
      transactions: [], tasks: [], legacyTasks: [], tickets: [], notes: [],
    });
    expect(copy.resetFields).toMatchObject({
      portalPin: null, mustChangePin: false, totalReferrals: 0, referredByClientId: null,
      vipTier: null, vipEnrolledAt: null, status: "active", mergedIntoId: null, mergedAt: null, mergedBy: null,
    });
  });

  it("every planned copy in a migration carries the reset list", () => {
    const plan = planOrgMigration(
      input({
        roleRows: [hwRole("h1")],
        clients: [{ id: "c1", createdBy: "s1", branchId: "shop1" }],
        transactions: [
          { id: "t1", userId: "h1", branchId: "shop1", clientId: "c1" },
          { id: "t9", userId: "s1", branchId: "shop1", clientId: "c1" },
        ],
      }),
    );
    expect(byType(plan, "create_client_copy").every((c) => c.resetFields === CLIENT_COPY_RESET_FIELDS)).toBe(true);
  });

  it("emits no repoint ops for empty row sets", () => {
    const result = planClientSplit({ id: "c1", createdBy: null, branchId: null }, "h1", "hb1", {
      transactions: [], tasks: [], legacyTasks: [], tickets: [], notes: [],
    });
    expect(result.repoints).toEqual([]);
  });
});
