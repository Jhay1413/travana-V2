/**
 * Phase 8: move every homeworker into their own homeworker branch.
 *
 *   tsx scripts/migrate-homeworker-branches.ts                          # dry run (default): report only, exits 0
 *   tsx scripts/migrate-homeworker-branches.ts --org <orgUuid>          # limit to one organization
 *   tsx scripts/migrate-homeworker-branches.ts --apply --confirm-db <databaseName>
 *   tsx scripts/migrate-homeworker-branches.ts --apply --confirm-db <databaseName> --force
 *
 * Planning is pure and lives in scripts/lib/homeworker-migration-plan.ts. This file loads rows,
 * prints the report and (with --apply) executes the planned operations in order. Each org is
 * loaded, planned and applied inside ONE transaction; every UPDATE/DELETE asserts the number of
 * rows it touched and throws (rolling that org back) on any mismatch. A failure in one org is
 * logged and the next org still runs. Idempotent: homeworkers who already own a homeworker
 * branch are skipped, and orgs without any homeworker are not even loaded.
 *
 * Exit codes: 0 ok (dry run is always 0 unless an org failed), 1 an org failed or bad usage,
 * 2 --apply refused at least one org because of BLOCKING conflicts (--force overrides those;
 * informational conflicts never block).
 *
 * PRE-FLIGHT CHECKLIST (operator)
 *  1. Take a database snapshot/backup and note how to restore it.
 *  2. Confirm migrations through 0057 are applied on THIS database (the script re-checks
 *     branches.owner_user_id, branches.profit_share_percent, client_table.split_from_client_id
 *     and the branches_owner_user_id_unique constraint in schema public).
 *  3. Deploy the server build that understands homeworker branches (Phase 1-7) before running.
 *  4. Pause or accept the risk of concurrent writes: transactions are per org, but rows are not
 *     locked, so a user editing a client mid-run can make the row-count guards abort that org.
 *  5. Run a dry run first (no flags). Read the masked host/database line to be sure which
 *     database you are on. Review every BLOCKING conflict and resolve it (or decide to use
 *     --force knowingly): multi-org homeworkers, homeworkers who are org_admin/branch_manager,
 *     duplicate agent targets, a legacy branch that is the org default or still has other
 *     members, an org with no active shop branch.
 *  6. Review the informational list (client splits/moves, deleted agent/social roles, inactive
 *     homeworkers carried over, residue rows re-homed to the default shop branch).
 *  7. Try one org first: --apply --confirm-db <name> --org <uuid>. Spot-check in the app
 *     (homeworker login, their clients, shop staff cannot see them, org overview list).
 *  8. Roll out the rest with --apply --confirm-db <name>. --confirm-db must equal the connected
 *     database name or the script refuses.
 *  9. Re-run the dry run: it must report nothing left to do (idempotency check).
 * 10. Keep the report output with the change record.
 */
import { db } from "../server/v2/config/database";
import {
  organization,
  branches,
  branchMembers,
  user,
  userOrgRoles,
  clientTable,
  transaction,
  task,
  tasks,
  tickets,
  notes,
  agentTargetTable,
  quote,
  enquiry_table,
  booking,
} from "../shared/schema";
import { and, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import {
  planOrgMigration,
  formatReport,
  blockingConflicts,
  type OrgMigrationInput,
  type PlanOperation,
  type MigrationPlan,
  type PlanEntityLink,
} from "./lib/homeworker-migration-plan";
import { parseArgs, maskDatabaseUrl, expectCount, runPerOrg, summariseOutcomes, exitCodeFor } from "./lib/migration-cli";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const CHUNK = 1000;
function chunks<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK) out.push(items.slice(i, i + CHUNK));
  return out;
}

async function inChunks<T>(ids: string[], load: (chunk: string[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (const c of chunks(ids)) out.push(...(await load(c)));
  return out;
}

function dedupe<T extends { id: string }>(rows: T[]): T[] {
  return Array.from(new Map(rows.map((r) => [r.id, r] as const)).values());
}

// ─── Target database identity and preconditions ───────────────────────────────

async function currentDatabaseName(): Promise<string> {
  const result = await db.execute(sql`SELECT current_database() AS name`);
  return String((result.rows as Array<{ name: string }>)[0]?.name ?? "");
}

async function assertMigration0057Applied(): Promise<void> {
  const columns = await db.execute(sql`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = 'public'
      AND ((table_name = 'branches' AND column_name IN ('owner_user_id', 'profit_share_percent'))
        OR (table_name = 'client_table' AND column_name = 'split_from_client_id'))
  `);
  const found = new Set((columns.rows as Array<{ table_name: string; column_name: string }>).map((r) => `${r.table_name}.${r.column_name}`));
  for (const required of ["branches.owner_user_id", "branches.profit_share_percent", "client_table.split_from_client_id"]) {
    if (!found.has(required)) throw new Error(`Migration 0057 is not applied: ${required} is missing. Aborting.`);
  }
  const constraint = await db.execute(sql`
    SELECT 1 AS ok FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'branches' AND constraint_name = 'branches_owner_user_id_unique'
  `);
  if (constraint.rows.length === 0) {
    throw new Error("Migration 0057 is not applied: constraint branches_owner_user_id_unique is missing. Aborting.");
  }
}

// ─── Loading (inside the org transaction) ─────────────────────────────────────

/** Orgs that have at least one homeworker role row or homeworker membership. */
async function orgIdsWithHomeworkers(only: string | null): Promise<Set<string>> {
  const [roleOrgs, memberOrgs] = await Promise.all([
    db.selectDistinct({ orgId: userOrgRoles.orgId }).from(userOrgRoles).where(eq(userOrgRoles.role, "homeworker")),
    db.selectDistinct({ orgId: branchMembers.orgId }).from(branchMembers).where(eq(branchMembers.orgRole, "homeworker")),
  ]);
  const ids = new Set([...roleOrgs, ...memberOrgs].map((r) => r.orgId));
  if (only) return new Set(ids.has(only) ? [only] : []);
  return ids;
}

async function loadOrgInput(tx: Tx, orgId: string, homeworkerCommission: number | null): Promise<OrgMigrationInput | null> {
  const [roleRows, memberships, branchRows] = await Promise.all([
    tx.select({ id: userOrgRoles.id, userId: userOrgRoles.userId, role: userOrgRoles.role }).from(userOrgRoles).where(eq(userOrgRoles.orgId, orgId)),
    tx
      .select({ id: branchMembers.id, userId: branchMembers.userId, branchId: branchMembers.branchId, orgRole: branchMembers.orgRole, isActive: branchMembers.isActive })
      .from(branchMembers)
      .where(eq(branchMembers.orgId, orgId)),
    tx
      .select({ id: branches.id, name: branches.name, branchType: branches.branchType, ownerUserId: branches.ownerUserId, isDefault: branches.isDefault, isActive: branches.isActive })
      .from(branches)
      .where(eq(branches.organizationId, orgId)),
  ]);

  const homeworkerIds = Array.from(
    new Set([
      ...roleRows.filter((r) => r.role === "homeworker").map((r) => r.userId),
      ...memberships.filter((m) => m.orgRole === "homeworker").map((m) => m.userId),
    ]),
  );
  if (homeworkerIds.length === 0) return null;

  // owner_user_id is globally unique: anyone who is a homeworker in another org cannot own a second branch.
  const [otherRoleOrgs, otherMemberOrgs, userRows] = await Promise.all([
    inChunks(homeworkerIds, (ids) =>
      tx.select({ userId: userOrgRoles.userId }).from(userOrgRoles).where(and(eq(userOrgRoles.role, "homeworker"), ne(userOrgRoles.orgId, orgId), inArray(userOrgRoles.userId, ids))),
    ),
    inChunks(homeworkerIds, (ids) =>
      tx.select({ userId: branchMembers.userId }).from(branchMembers).where(and(eq(branchMembers.orgRole, "homeworker"), ne(branchMembers.orgId, orgId), inArray(branchMembers.userId, ids))),
    ),
    inChunks(homeworkerIds, (ids) =>
      tx.select({ id: user.id, firstName: user.firstName, lastName: user.lastName, name: user.name, email: user.email }).from(user).where(inArray(user.id, ids)),
    ),
  ]);
  const multiOrgUserIds = Array.from(new Set([...otherRoleOrgs, ...otherMemberOrgs].map((r) => r.userId)));

  // Rows are matched by org, plus rows with a NULL org that clearly belong to a homeworker.
  const clientCols = { id: clientTable.id, createdBy: clientTable.createdBy, branchId: clientTable.branchId, orgId: clientTable.orgId, status: clientTable.status, mergedIntoId: clientTable.mergedIntoId };
  const clientRows = dedupe([
    ...(await tx.select(clientCols).from(clientTable).where(eq(clientTable.orgId, orgId))),
    ...(await inChunks(homeworkerIds, (ids) => tx.select(clientCols).from(clientTable).where(and(isNull(clientTable.orgId), inArray(clientTable.createdBy, ids))))),
  ]);
  const clientIds = clientRows.map((c) => c.id);

  const txnCols = { id: transaction.id, userId: transaction.user_id, branchId: transaction.branch_id, clientId: transaction.client_id, orgId: transaction.org_id };
  const transactionRows = dedupe([
    ...(await tx.select(txnCols).from(transaction).where(eq(transaction.org_id, orgId))),
    ...(await inChunks(homeworkerIds, (ids) => tx.select(txnCols).from(transaction).where(and(isNull(transaction.org_id), inArray(transaction.user_id, ids))))),
    ...(await inChunks(clientIds, (ids) => tx.select(txnCols).from(transaction).where(and(isNull(transaction.org_id), inArray(transaction.client_id, ids))))),
  ]);
  const txnIds = transactionRows.map((t) => t.id);

  // tasks link to quote/enquiry/booking ids, not to deals: resolve them through their transaction.
  const entityLinks: PlanEntityLink[] = [
    ...(await inChunks(txnIds, (ids) => tx.select({ entityId: quote.id, transactionId: quote.transaction_id }).from(quote).where(inArray(quote.transaction_id, ids)))).map(
      (r): PlanEntityLink => ({ entityType: "quote", entityId: r.entityId, transactionId: r.transactionId }),
    ),
    ...(await inChunks(txnIds, (ids) => tx.select({ entityId: enquiry_table.id, transactionId: enquiry_table.transaction_id }).from(enquiry_table).where(inArray(enquiry_table.transaction_id, ids)))).map(
      (r): PlanEntityLink => ({ entityType: "enquiry", entityId: r.entityId, transactionId: r.transactionId }),
    ),
    ...(await inChunks(txnIds, (ids) => tx.select({ entityId: booking.id, transactionId: booking.transaction_id }).from(booking).where(inArray(booking.transaction_id, ids)))).map(
      (r): PlanEntityLink => ({ entityType: "booking", entityId: r.entityId, transactionId: r.transactionId }),
    ),
  ];
  const linkedEntityIds = entityLinks.map((l) => l.entityId);
  const relatedEntityIds = [...txnIds, ...clientIds, ...linkedEntityIds];

  const taskCols = { id: tasks.id, userId: tasks.userId, branchId: tasks.branchId, entityType: tasks.entityType, entityId: tasks.entityId, orgId: tasks.orgId };
  const taskRows = dedupe([
    ...(await tx.select(taskCols).from(tasks).where(eq(tasks.orgId, orgId))),
    ...(await inChunks(homeworkerIds, (ids) => tx.select(taskCols).from(tasks).where(and(isNull(tasks.orgId), inArray(tasks.userId, ids))))),
    ...(await inChunks(relatedEntityIds, (ids) => tx.select(taskCols).from(tasks).where(and(isNull(tasks.orgId), inArray(tasks.entityId, ids))))),
  ]);

  const legacyCols = { id: task.id, userId: task.user_id, branchId: task.branch_id, transactionId: task.transaction_id, clientId: task.client_id, orgId: task.org_id };
  const legacyTaskRows = dedupe([
    ...(await tx.select(legacyCols).from(task).where(eq(task.org_id, orgId))),
    ...(await inChunks(homeworkerIds, (ids) => tx.select(legacyCols).from(task).where(and(isNull(task.org_id), inArray(task.user_id, ids))))),
    ...(await inChunks(txnIds, (ids) => tx.select(legacyCols).from(task).where(and(isNull(task.org_id), inArray(task.transaction_id, ids))))),
    ...(await inChunks(clientIds, (ids) => tx.select(legacyCols).from(task).where(and(isNull(task.org_id), inArray(task.client_id, ids))))),
  ]);

  const ticketCols = { id: tickets.id, userId: tickets.userId, branchId: tickets.branchId, transactionId: tickets.transactionId, clientId: tickets.clientId, orgId: tickets.orgId };
  const ticketRows = dedupe([
    ...(await tx.select(ticketCols).from(tickets).where(eq(tickets.orgId, orgId))),
    ...(await inChunks(homeworkerIds, (ids) => tx.select(ticketCols).from(tickets).where(and(isNull(tickets.orgId), inArray(tickets.userId, ids))))),
    ...(await inChunks(txnIds, (ids) => tx.select(ticketCols).from(tickets).where(and(isNull(tickets.orgId), inArray(tickets.transactionId, ids))))),
    ...(await inChunks(clientIds, (ids) => tx.select(ticketCols).from(tickets).where(and(isNull(tickets.orgId), inArray(tickets.clientId, ids))))),
  ]);

  // notes has no org column, so it is loaded by link, and only for the clients and deals a
  // homeworker touches (their own, plus the other side's deals on a homeworker client), in
  // chunks of ids. A client/transaction-scoped query can still be slow on very large orgs.
  const homeworkerSet = new Set(homeworkerIds);
  const relevantClientIds = new Set<string>();
  for (const c of clientRows) if (c.createdBy && homeworkerSet.has(c.createdBy)) relevantClientIds.add(c.id);
  for (const t of transactionRows) if (t.clientId && homeworkerSet.has(t.userId)) relevantClientIds.add(t.clientId);
  const relevantTransactionIds = new Set<string>();
  for (const t of transactionRows) {
    if (homeworkerSet.has(t.userId) || (t.clientId && relevantClientIds.has(t.clientId))) relevantTransactionIds.add(t.id);
  }
  const noteCols = { id: notes.id, userId: notes.user_id, agentId: notes.agent_id, transactionId: notes.transaction_id, clientId: notes.client_id };
  const noteRows = dedupe([
    ...(await inChunks(Array.from(relevantClientIds), (ids) => tx.select(noteCols).from(notes).where(inArray(notes.client_id, ids)))),
    ...(await inChunks(Array.from(relevantTransactionIds), (ids) => tx.select(noteCols).from(notes).where(inArray(notes.transaction_id, ids)))),
  ]);

  const targetRows = await tx
    .select({
      id: agentTargetTable.id,
      userId: agentTargetTable.userId,
      branchId: agentTargetTable.branchId,
      year: agentTargetTable.year,
      month: agentTargetTable.month,
      targetAmount: agentTargetTable.targetAmount,
      updatedAt: agentTargetTable.updatedAt,
      createdAt: agentTargetTable.createdAt,
    })
    .from(agentTargetTable)
    .innerJoin(branches, eq(branches.id, agentTargetTable.branchId))
    .where(eq(branches.organizationId, orgId));

  return {
    org: { id: orgId, homeworkerCommission },
    users: userRows,
    roleRows,
    memberships,
    branches: branchRows.map((b) => ({ ...b, branchType: b.branchType === "homeworker" ? "homeworker" : "shop" })),
    clients: clientRows.map((c) => ({ ...c, status: c.status === "merged" ? "merged" : "active" })),
    transactions: transactionRows,
    tasks: taskRows,
    legacyTasks: legacyTaskRows,
    tickets: ticketRows,
    notes: noteRows,
    agentTargets: targetRows.map((t) => ({
      id: t.id,
      userId: t.userId,
      branchId: t.branchId,
      year: t.year,
      month: t.month,
      targetAmount: t.targetAmount,
      updatedAtMs: (t.updatedAt ?? t.createdAt).getTime(),
    })),
    entityLinks,
    multiOrgUserIds,
  };
}

// ─── Execution ────────────────────────────────────────────────────────────────

async function applyOperations(tx: Tx, orgId: string, operations: PlanOperation[]): Promise<void> {
  const branchIds = new Map<string, string>();
  const clientIds = new Map<string, string>();

  const branchId = (ref: string): string => {
    const resolved = branchIds.get(ref);
    if (resolved) return resolved;
    if (ref.startsWith("new-branch:")) throw new Error(`Branch ref ${ref} used before it was created`);
    return ref;
  };
  const clientId = (ref: string): string => {
    const resolved = clientIds.get(ref);
    if (!resolved) throw new Error(`Client ref ${ref} used before it was created`);
    return resolved;
  };

  // Rows with a NULL org column were included on purpose; the org guard accepts them.
  for (const op of operations) {
    switch (op.type) {
      case "delete_role_rows": {
        let n = 0;
        for (const ids of chunks(op.roleRowIds)) {
          n += (await tx.delete(userOrgRoles).where(and(inArray(userOrgRoles.id, ids), eq(userOrgRoles.orgId, orgId), eq(userOrgRoles.userId, op.userId))).returning({ id: userOrgRoles.id })).length;
        }
        expectCount(n, op.roleRowIds.length, `delete_role_rows(${op.userId})`);
        break;
      }

      case "insert_role_row": {
        const rows = await tx.insert(userOrgRoles).values({ userId: op.userId, orgId, role: op.role }).returning({ id: userOrgRoles.id });
        expectCount(rows.length, 1, `insert_role_row(${op.userId})`);
        break;
      }

      case "create_branch": {
        const rows = await tx
          .insert(branches)
          .values({
            organizationId: orgId,
            name: op.name,
            isDefault: false,
            isActive: true,
            branchType: "homeworker",
            ownerUserId: op.ownerUserId,
            profitSharePercent: op.profitSharePercent === null ? null : String(op.profitSharePercent),
          })
          .returning({ id: branches.id });
        expectCount(rows.length, 1, `create_branch(${op.ownerUserId})`);
        branchIds.set(op.ref, rows[0].id);
        break;
      }

      case "delete_memberships": {
        let n = 0;
        for (const ids of chunks(op.membershipIds)) {
          n += (await tx.delete(branchMembers).where(and(inArray(branchMembers.id, ids), eq(branchMembers.orgId, orgId), eq(branchMembers.userId, op.userId))).returning({ id: branchMembers.id })).length;
        }
        expectCount(n, op.membershipIds.length, `delete_memberships(${op.userId})`);
        break;
      }

      case "insert_membership": {
        const rows = await tx
          .insert(branchMembers)
          .values({ orgId, branchId: branchId(op.branchRef), userId: op.userId, orgRole: op.orgRole, isActive: op.isActive })
          .returning({ id: branchMembers.id });
        expectCount(rows.length, 1, `insert_membership(${op.userId})`);
        break;
      }

      case "set_user_org_role": {
        const rows = await tx
          .update(user)
          .set({ orgRole: op.orgRole })
          .where(and(eq(user.id, op.userId), or(eq(user.orgId, orgId), isNull(user.orgId))))
          .returning({ id: user.id });
        expectCount(rows.length, 1, `set_user_org_role(${op.userId})`);
        break;
      }

      case "create_client_copy": {
        const [original] = await tx.select().from(clientTable).where(and(eq(clientTable.id, op.originalClientId), or(eq(clientTable.orgId, orgId), isNull(clientTable.orgId))));
        if (!original) throw new Error(`Original client ${op.originalClientId} not found in org ${orgId}`);
        if (original.status === "merged") throw new Error(`Refusing to copy merged client ${original.id}`);
        const { id: _id, createdAt: _createdAt, ...personal } = original;
        const rows = await tx
          .insert(clientTable)
          .values({
            ...personal,
            ...op.resetFields,
            orgId,
            createdBy: op.createdBy,
            branchId: op.branchRef === null ? null : branchId(op.branchRef),
            splitFromClientId: original.id,
          })
          .returning({ id: clientTable.id });
        expectCount(rows.length, 1, `create_client_copy(${op.originalClientId})`);
        clientIds.set(op.ref, rows[0].id);
        break;
      }

      case "set_branch": {
        const target = branchId(op.branchRef);
        let n = 0;
        for (const ids of chunks(op.ids)) {
          switch (op.table) {
            case "client_table":
              n += (await tx.update(clientTable).set({ branchId: target }).where(and(inArray(clientTable.id, ids), or(eq(clientTable.orgId, orgId), isNull(clientTable.orgId)))).returning({ id: clientTable.id })).length;
              break;
            case "transaction":
              n += (await tx.update(transaction).set({ branch_id: target }).where(and(inArray(transaction.id, ids), or(eq(transaction.org_id, orgId), isNull(transaction.org_id)))).returning({ id: transaction.id })).length;
              break;
            case "task":
              n += (await tx.update(task).set({ branch_id: target }).where(and(inArray(task.id, ids), or(eq(task.org_id, orgId), isNull(task.org_id)))).returning({ id: task.id })).length;
              break;
            case "tasks":
              n += (await tx.update(tasks).set({ branchId: target }).where(and(inArray(tasks.id, ids), or(eq(tasks.orgId, orgId), isNull(tasks.orgId)))).returning({ id: tasks.id })).length;
              break;
            case "tickets":
              n += (await tx.update(tickets).set({ branchId: target }).where(and(inArray(tickets.id, ids), or(eq(tickets.orgId, orgId), isNull(tickets.orgId)))).returning({ id: tickets.id })).length;
              break;
            case "agent_target_table":
              // No org column: the guard is "the row's current branch belongs to this org".
              n += (
                await tx
                  .update(agentTargetTable)
                  .set({ branchId: target })
                  .where(
                    and(
                      inArray(agentTargetTable.id, ids),
                      inArray(agentTargetTable.branchId, tx.select({ id: branches.id }).from(branches).where(eq(branches.organizationId, orgId))),
                    ),
                  )
                  .returning({ id: agentTargetTable.id })
              ).length;
              break;
          }
        }
        expectCount(n, op.ids.length, `set_branch(${op.table})`);

        // Fill the org id on rows that had none.
        let filled = 0;
        for (const ids of chunks(op.fillOrgIds)) {
          switch (op.table) {
            case "client_table":
              filled += (await tx.update(clientTable).set({ orgId }).where(and(inArray(clientTable.id, ids), isNull(clientTable.orgId))).returning({ id: clientTable.id })).length;
              break;
            case "transaction":
              filled += (await tx.update(transaction).set({ org_id: orgId }).where(and(inArray(transaction.id, ids), isNull(transaction.org_id))).returning({ id: transaction.id })).length;
              break;
            case "task":
              filled += (await tx.update(task).set({ org_id: orgId }).where(and(inArray(task.id, ids), isNull(task.org_id))).returning({ id: task.id })).length;
              break;
            case "tasks":
              filled += (await tx.update(tasks).set({ orgId }).where(and(inArray(tasks.id, ids), isNull(tasks.orgId))).returning({ id: tasks.id })).length;
              break;
            case "tickets":
              filled += (await tx.update(tickets).set({ orgId }).where(and(inArray(tickets.id, ids), isNull(tickets.orgId))).returning({ id: tickets.id })).length;
              break;
            case "agent_target_table":
              break;
          }
        }
        expectCount(filled, op.fillOrgIds.length, `fill org_id(${op.table})`);
        break;
      }

      case "set_client": {
        const copyId = clientId(op.clientRef);
        let n = 0;
        for (const ids of chunks(op.ids)) {
          switch (op.table) {
            case "transaction":
              n += (await tx.update(transaction).set({ client_id: copyId }).where(and(inArray(transaction.id, ids), eq(transaction.client_id, op.fromClientId), or(eq(transaction.org_id, orgId), isNull(transaction.org_id)))).returning({ id: transaction.id })).length;
              break;
            case "task":
              n += (await tx.update(task).set({ client_id: copyId }).where(and(inArray(task.id, ids), eq(task.client_id, op.fromClientId), or(eq(task.org_id, orgId), isNull(task.org_id)))).returning({ id: task.id })).length;
              break;
            case "tasks":
              n += (await tx.update(tasks).set({ entityId: copyId }).where(and(inArray(tasks.id, ids), eq(tasks.entityType, "client"), eq(tasks.entityId, op.fromClientId), or(eq(tasks.orgId, orgId), isNull(tasks.orgId)))).returning({ id: tasks.id })).length;
              break;
            case "tickets":
              n += (await tx.update(tickets).set({ clientId: copyId }).where(and(inArray(tickets.id, ids), eq(tickets.clientId, op.fromClientId), or(eq(tickets.orgId, orgId), isNull(tickets.orgId)))).returning({ id: tickets.id })).length;
              break;
            case "notes":
              // notes has no org column; the id and the original client guard it.
              n += (await tx.update(notes).set({ client_id: copyId }).where(and(inArray(notes.id, ids), eq(notes.client_id, op.fromClientId))).returning({ id: notes.id })).length;
              break;
          }
        }
        expectCount(n, op.ids.length, `set_client(${op.table})`);
        break;
      }

      case "archive_branch": {
        const rows = await tx
          .update(branches)
          .set({ isActive: false, isDefault: false })
          .where(and(eq(branches.id, op.branchId), eq(branches.organizationId, orgId)))
          .returning({ id: branches.id });
        expectCount(rows.length, 1, `archive_branch(${op.branchId})`);
        break;
      }
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<number> {
  const options = parseArgs(process.argv.slice(2));
  console.log(options.apply ? "MODE: APPLY" : "DRY RUN — no changes made");
  console.log(`Target database: ${maskDatabaseUrl(process.env.DATABASE_URL ?? "")}`);

  const databaseName = await currentDatabaseName();
  console.log(`Connected database name: ${databaseName}`);
  await assertMigration0057Applied();
  if (options.apply && options.confirmDb !== databaseName) {
    throw new Error(`--apply requires --confirm-db ${databaseName} (the connected database). Got: ${options.confirmDb ?? "(missing)"}`);
  }

  const candidateOrgs = await orgIdsWithHomeworkers(options.orgId);
  if (options.orgId && candidateOrgs.size === 0) console.log(`Organization ${options.orgId} has no homeworkers (or does not exist); nothing to do.`);
  const orgRows = candidateOrgs.size === 0
    ? []
    : await db
        .select({ id: organization.id, name: organization.name, homeworkerCommission: organization.homeworkerCommission })
        .from(organization)
        .where(inArray(organization.id, Array.from(candidateOrgs)));

  const planned: MigrationPlan[] = [];
  const commissionByOrg = new Map(orgRows.map((o) => [o.id, o.homeworkerCommission] as const));
  const outcomes = await runPerOrg(orgRows, async (org) => {
    // Load, plan and apply in ONE transaction; any throw rolls this org back.
    return db.transaction(async (tx) => {
      const input = await loadOrgInput(tx, org.id, commissionByOrg.get(org.id) ?? null);
      if (!input) return { status: "nothing" as const };
      const plan = planOrgMigration(input);
      planned.push(plan);
      if (plan.operations.length > 0 || plan.report.conflicts.length > 0) {
        console.log(`\n=== ${org.name} (${org.id}) ===`);
        console.log(formatReport(plan.report));
      }
      if (!options.apply) return { status: "planned" as const, detail: `${plan.operations.length} operation(s)` };
      const blocking = blockingConflicts(plan.report);
      if (blocking.length > 0 && !options.force) {
        return { status: "refused" as const, detail: `${blocking.length} blocking conflict(s)` };
      }
      if (plan.operations.length === 0) return { status: "nothing" as const };
      await applyOperations(tx, org.id, plan.operations);
      return { status: "committed" as const, detail: `${plan.operations.length} operation(s)` };
    });
  });

  const counts = summariseOutcomes(outcomes);
  const totalBlocking = planned.reduce((n, p) => n + blockingConflicts(p.report).length, 0);
  console.log(
    `\nSummary: ${orgRows.length} org(s) with homeworkers; ${counts.committed} committed, ${counts.refused} refused, ${counts.failed} failed, ${counts.planned} planned (dry run), ${counts.nothing} nothing to do.`,
  );
  for (const o of outcomes.filter((x) => x.status === "failed" || x.status === "refused")) {
    console.log(`  ${o.status.toUpperCase()} ${o.orgId} (${o.name}): ${o.detail ?? ""}`);
  }

  if (counts.failed > 0) return 1;

  if (!options.apply) {
    console.log("\nDRY RUN — no changes made.");
    if (totalBlocking > 0) {
      console.log(`${totalBlocking} BLOCKING conflict(s) are listed above; they must be resolved before an apply will go ahead.`);
    } else {
      const orgArg = options.orgId ? ` --org ${options.orgId}` : "";
      console.log("To apply, run:");
      console.log(`  npx tsx scripts/migrate-homeworker-branches.ts --apply --confirm-db ${databaseName}${orgArg}`);
    }
    return 0;
  }
  return exitCodeFor(outcomes, options.apply);
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
