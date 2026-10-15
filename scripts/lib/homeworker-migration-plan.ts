/**
 * Pure planner for the homeworker-branch data migration (docs/homeworker-branch-plan.md, Phase 8).
 *
 * No DB access and no side effects: it takes one org's rows as plain data and returns an
 * ordered list of operations plus a report. The runner (scripts/migrate-homeworker-branches.ts)
 * loads the data, calls `planOrgMigration`, prints the report and, only with --apply, executes
 * the operations in order inside one transaction per org.
 *
 * Shared-client policy (decided): the ORIGINAL client always stays with its creator's side and
 * the other side gets a COPY (created_by = that user, split_from_client_id = original, portal and
 * referral fields reset). The one exception is when nobody but the homeworker has deals on a
 * client created by someone who is not a homeworker: then the client is MOVED to the homeworker
 * branch (created_by kept) instead of copied, so there is no pointless duplicate.
 *
 * Row ownership precedence for tickets and tasks (first arm that decides wins, later arms never
 * override it): 1. a row already re-pointed to a client copy follows the copy's side; 2. the
 * linked transaction's owner side; 3. the client's side; 4. the creator.
 */
import { placeholderNameForEmail } from "../../server/v2/utils/homeworker-name";

// ─── Input types (plain rows, no drizzle types so the planner stays testable) ──

export interface PlanOrg {
  id: string;
  homeworkerCommission: number | null;
}

export interface PlanUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  email: string | null;
}

export interface PlanRoleRow {
  id: string;
  userId: string;
  role: string;
}

export interface PlanMembership {
  id: string;
  userId: string;
  branchId: string;
  orgRole: string;
  isActive: boolean;
}

export interface PlanBranch {
  id: string;
  name: string;
  branchType: "shop" | "homeworker";
  ownerUserId: string | null;
  isDefault: boolean;
  isActive: boolean;
}

export interface PlanClient {
  id: string;
  createdBy: string | null;
  branchId: string | null;
  orgId?: string | null;
  /** Defaults to active. A merged client is never copied; its mergedIntoId is followed. */
  status?: "active" | "merged";
  mergedIntoId?: string | null;
}

export interface PlanTransaction {
  id: string;
  userId: string;
  branchId: string | null;
  clientId: string | null;
  orgId?: string | null;
}

/** New `tasks` table: linked to a record through entityType/entityId. */
export interface PlanTask {
  id: string;
  userId: string | null;
  branchId: string | null;
  entityType: string | null;
  entityId: string | null;
  orgId?: string | null;
}

/** Legacy `task` table: direct client_id / transaction_id columns. */
export interface PlanLegacyTask {
  id: string;
  userId: string | null;
  branchId: string | null;
  transactionId: string | null;
  clientId: string | null;
  orgId?: string | null;
}

export interface PlanTicket {
  id: string;
  userId: string;
  branchId: string | null;
  transactionId: string | null;
  clientId: string | null;
  orgId?: string | null;
}

export interface PlanNote {
  id: string;
  userId: string | null;
  agentId: string | null;
  transactionId: string | null;
  clientId: string | null;
}

export interface PlanAgentTarget {
  id: string;
  userId: string;
  branchId: string;
  year: number;
  month: number;
  targetAmount?: string;
  /** Epoch ms of updated_at (falls back to created_at); the newest duplicate wins. */
  updatedAtMs?: number;
}

/** Maps a quote / enquiry / booking id to its transaction (tasks link to these, not to deals). */
export interface PlanEntityLink {
  entityType: "quote" | "enquiry" | "booking";
  entityId: string;
  transactionId: string;
}

export interface OrgMigrationInput {
  org: PlanOrg;
  users: PlanUser[];
  roleRows: PlanRoleRow[];
  memberships: PlanMembership[];
  branches: PlanBranch[];
  clients: PlanClient[];
  transactions: PlanTransaction[];
  tasks: PlanTask[];
  legacyTasks: PlanLegacyTask[];
  tickets: PlanTicket[];
  notes: PlanNote[];
  agentTargets: PlanAgentTarget[];
  entityLinks?: PlanEntityLink[];
  /** Users of this org who also hold the homeworker role in another org (owner_user_id is global). */
  multiOrgUserIds?: string[];
}

// ─── Output types ─────────────────────────────────────────────────────────────

/** An existing branch id, or a placeholder (`new-branch:<userId>`) for one this plan creates. */
export type BranchRef = string;
/** A placeholder (`new-client:<userId>:<originalClientId>`) for a client copy this plan creates. */
export type ClientRef = string;

/**
 * Columns reset on a client copy (client_table property names). The copy keeps the personal and
 * contact fields only; anything that grants access, tracks referrals/VIP status or records a
 * merge belongs to the original and must not be duplicated. client_table has no UNIQUE
 * constraint besides its primary key, so no other column needs de-duplicating.
 */
export const CLIENT_COPY_RESET_FIELDS = {
  // Portal access: the copy gets no PIN and none is forced to be changed.
  portalPin: null,
  mustChangePin: false,
  // Referral counters, links and the VIP tier they drive.
  totalReferrals: 0,
  referredByClientId: null,
  vipTier: null,
  vipEnrolledAt: null,
  // A copy is always a live client, never a merge artefact.
  status: "active",
  mergedIntoId: null,
  mergedAt: null,
  mergedBy: null,
} as const;

export type BranchTable = "client_table" | "transaction" | "task" | "tasks" | "tickets" | "agent_target_table";
export type ClientLinkTable = "transaction" | "task" | "tasks" | "tickets" | "notes";

export type PlanOperation =
  | { type: "delete_role_rows"; userId: string; roleRowIds: string[]; roles: string[] }
  | { type: "insert_role_row"; userId: string; role: "homeworker" }
  | { type: "create_branch"; ref: BranchRef; ownerUserId: string; name: string; profitSharePercent: number | null }
  | { type: "delete_memberships"; userId: string; membershipIds: string[] }
  | { type: "insert_membership"; userId: string; branchRef: BranchRef; orgRole: "homeworker"; isActive: boolean }
  | { type: "set_user_org_role"; userId: string; orgRole: "homeworker" }
  | {
      type: "create_client_copy";
      ref: ClientRef;
      originalClientId: string;
      createdBy: string;
      /** Applied over the copied columns; see CLIENT_COPY_RESET_FIELDS. */
      resetFields: typeof CLIENT_COPY_RESET_FIELDS;
      /** Null only for a shop-side copy whose original had no usable branch. */
      branchRef: BranchRef | null;
    }
  | {
      type: "set_branch";
      table: BranchTable;
      ids: string[];
      branchRef: BranchRef;
      /** Subset of ids whose org column is NULL; the runner fills it with the org id. */
      fillOrgIds: string[];
    }
  | { type: "set_client"; table: ClientLinkTable; ids: string[]; fromClientId: string; clientRef: ClientRef }
  | { type: "archive_branch"; branchId: string };

export type ConflictSeverity = "blocking" | "informational";

export type ConflictKind =
  // blocking
  | "row_claimed_twice"
  | "agent_target_conflict"
  | "legacy_branch_not_archivable"
  | "legacy_branch_is_default"
  | "multi_org_owner"
  | "admin_or_manager_role"
  | "no_default_shop_branch"
  // informational
  | "client_split"
  | "client_moved"
  | "extra_roles_removed"
  | "inactive_homeworker_carried_over"
  | "homeworker_in_shop_branch"
  | "legacy_branch_residue";

export const BLOCKING_CONFLICT_KINDS: readonly ConflictKind[] = [
  "row_claimed_twice",
  "agent_target_conflict",
  "legacy_branch_not_archivable",
  "legacy_branch_is_default",
  "multi_org_owner",
  "admin_or_manager_role",
  "no_default_shop_branch",
];

export interface Conflict {
  kind: ConflictKind;
  severity: ConflictSeverity;
  userId?: string;
  message: string;
}

export interface ClientSplitReport {
  originalClientId: string;
  copyRef: ClientRef;
  userId: string;
  side: "homeworker" | "shop";
  counts: { transactions: number; tasks: number; legacyTasks: number; tickets: number; notes: number };
}

export interface BranchColumnReview {
  table: string;
  column: string;
  decision: "migrated" | "not applicable";
  reason: string;
}

export interface MigrationReport {
  orgId: string;
  homeworkersFound: Array<{ userId: string; name: string; email: string | null; sources: Array<"role" | "membership"> }>;
  alreadyMigrated: string[];
  /** Users left untouched because of a blocking conflict (multi-org owner, org_admin/branch_manager). */
  skippedUsers: Array<{ userId: string; reason: "multi_org_owner" | "admin_or_manager_role" }>;
  /** Homeworkers whose new membership is inactive because they had no active membership. */
  inactiveHomeworkers: Array<{ userId: string; reason: "no_membership" | "inactive_membership" }>;
  branchesToCreate: Array<{ ref: BranchRef; ownerUserId: string; name: string; profitSharePercent: number | null }>;
  /** Rows whose branch_id is rewritten, per table. */
  branchRewrites: Record<BranchTable, number>;
  /** Rows re-pointed from an original client to a copy, per table. */
  clientRepoints: Record<ClientLinkTable, number>;
  clientSplits: ClientSplitReport[];
  clientMoves: Array<{ clientId: string; userId: string }>;
  homeworkersInShopBranches: Array<{ userId: string; branchId: string; branchName: string }>;
  roleRowsToDelete: Array<{ userId: string; roles: string[] }>;
  legacyBranchesToArchive: Array<{ branchId: string; name: string }>;
  legacyBranchesBlocked: Array<{ branchId: string; name: string; reason: string; remainingMemberIds: string[] }>;
  /** Rows still referencing a legacy branch after homeworker rows moved out (never homeworker data). */
  legacyBranchResidue: Array<{
    branchId: string;
    name: string;
    counts: { clients: number; transactions: number; tasks: number; legacyTasks: number; tickets: number };
    reassignedTo: string | null;
  }>;
  agentTargetsSkipped: Array<{ id: string; userId: string; year: number; month: number; amount: string | null; keptId: string; keptAmount: string | null }>;
  branchIdColumnsReviewed: BranchColumnReview[];
  conflicts: Conflict[];
}

export interface MigrationPlan {
  orgId: string;
  /** Execute strictly in this order. */
  operations: PlanOperation[];
  report: MigrationReport;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Roles dropped from a homeworker (homeworker wins). org_admin / branch_manager block instead. */
export const ROLES_REMOVED_FROM_HOMEWORKERS: readonly string[] = ["agent", "social_media_manager"];
/** A homeworker holding one of these is skipped entirely and reported as a blocking conflict. */
export const ROLES_BLOCKING_HOMEWORKERS: readonly string[] = ["org_admin", "branch_manager"];

export const BRANCH_ID_COLUMN_REVIEW: readonly BranchColumnReview[] = [
  { table: "client_table", column: "branch_id", decision: "migrated", reason: "clients created by the homeworker (or moved to them) get their branch; copies are created there" },
  { table: "transaction", column: "branch_id", decision: "migrated", reason: "deals owned by the homeworker; quote, enquiry and booking follow their transaction" },
  { table: "task", column: "branch_id", decision: "migrated", reason: "legacy tasks follow their deal, then client, then creator" },
  { table: "tasks", column: "branch_id", decision: "migrated", reason: "tasks follow their deal (via quote/enquiry/booking), then client, then creator" },
  { table: "tickets", column: "branch_id", decision: "migrated", reason: "tickets follow the linked transaction, else the client, else the creator" },
  { table: "agent_target_table", column: "branch_id", decision: "migrated", reason: "targets keyed by (branch_id, user_id) move to the homeworker branch; the newest duplicate per month wins" },
  { table: "branch_members", column: "branch_id", decision: "migrated", reason: "old memberships removed, one membership (active only if they had an active one) inserted in the new branch" },
  { table: "shop_target_table", column: "branch_id", decision: "not applicable", reason: "homeworker branches have no shop target; shop branch targets are untouched" },
  { table: "forwards_report", column: "branch_id", decision: "not applicable", reason: "org-level report snapshot rows, not per-user records" },
  { table: "training_course", column: "branch_id", decision: "not applicable", reason: "course visibility scope, not homeworker data" },
  { table: "client_merge_log", column: "branch_id", decision: "not applicable", reason: "historical audit log; keeps the branch the merge happened in" },
  { table: "homeworker_payout_statement", column: "branch_id", decision: "not applicable", reason: "created after migration, already keyed by the homeworker branch" },
  { table: "notes", column: "(no branch_id)", decision: "not applicable", reason: "notes scope through their transaction or client; only copied-client links are re-pointed" },
];

const BRANCH_TABLES: BranchTable[] = ["client_table", "transaction", "tasks", "task", "tickets", "agent_target_table"];
const CLIENT_TABLES: ClientLinkTable[] = ["transaction", "task", "tasks", "tickets", "notes"];

export function newBranchRef(userId: string): BranchRef {
  return `new-branch:${userId}`;
}

export function newClientRef(userId: string, originalClientId: string): ClientRef {
  return `new-client:${userId}:${originalClientId}`;
}

export function isPlaceholderRef(ref: string): boolean {
  return ref.startsWith("new-branch:") || ref.startsWith("new-client:");
}

export function blockingConflicts(report: MigrationReport): Conflict[] {
  return report.conflicts.filter((c) => c.severity === "blocking");
}

export function informationalConflicts(report: MigrationReport): Conflict[] {
  return report.conflicts.filter((c) => c.severity === "informational");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isRealNamePart(part: string | null): part is string {
  if (!part) return false;
  const t = part.trim();
  // Invites store "—" as the last name when none was given.
  return t !== "" && t !== "—" && t !== "-";
}

/** Full name; else the display name unless it is just the email; else the email placeholder. */
export function homeworkerBranchName(user: PlanUser | undefined, userId: string): string {
  if (!user) return userId;
  const full = [user.firstName, user.lastName].filter(isRealNamePart).join(" ").trim();
  if (full) return full;
  const display = user.name?.trim();
  const email = user.email?.trim();
  if (display && (!email || display.toLowerCase() !== email.toLowerCase())) return display;
  if (email) return placeholderNameForEmail(email);
  return userId;
}

function normaliseShare(value: number | null): number | null {
  if (value === null || !Number.isFinite(value) || value < 0 || value > 100) return null;
  return value;
}

function zeroRecord<K extends string>(keys: readonly K[]): Record<K, number> {
  const out = {} as Record<K, number>;
  for (const k of keys) out[k] = 0;
  return out;
}

function byId<T extends { id: string }>(a: T, b: T): number {
  return a.id.localeCompare(b.id);
}

function groupBy<T>(items: readonly T[], key: (item: T) => string | null | undefined): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (!k) continue;
    const list = out.get(k);
    if (list) list.push(item);
    else out.set(k, [item]);
  }
  return out;
}

/** First writer wins; a different later target for the same row is reported by the caller. */
export class RowAssignments {
  private readonly targets = new Map<string, string>();

  /** Returns true when stored (or identical), false when the row already has a different target. */
  assign(table: string, id: string, ref: string): boolean {
    const key = `${table}:${id}`;
    const existing = this.targets.get(key);
    if (existing === undefined) {
      this.targets.set(key, ref);
      return true;
    }
    return existing === ref;
  }

  get(table: string, id: string): string | undefined {
    return this.targets.get(`${table}:${id}`);
  }
}

// ─── Client split (shared by the migration and a future admin action) ─────────

export interface ClientSplitRelatedRows {
  /** The user's transactions on this client. */
  transactions: PlanTransaction[];
  /** Tasks whose entity IS the client (entityType "client"). */
  tasks: PlanTask[];
  legacyTasks: PlanLegacyTask[];
  tickets: PlanTicket[];
  notes: PlanNote[];
}

export interface ClientSplitPlan {
  copy: Extract<PlanOperation, { type: "create_client_copy" }>;
  repoints: Array<Extract<PlanOperation, { type: "set_client" }>>;
  counts: ClientSplitReport["counts"];
}

/**
 * Plan the duplication of one client for one user: a copy (created_by = user, in `newBranchId`)
 * plus the re-pointing of that user's rows to the copy. The original stays with the creator's
 * side. Only rows whose client column actually equals a client id are re-pointed, grouped by the
 * id they currently hold so the runner can guard each UPDATE on it.
 */
export function planClientSplit(
  client: PlanClient,
  userId: string,
  newBranchId: BranchRef | null,
  related: ClientSplitRelatedRows,
): ClientSplitPlan {
  const ref = newClientRef(userId, client.id);
  const repoints: ClientSplitPlan["repoints"] = [];
  const add = (table: ClientLinkTable, rows: Array<{ id: string; from: string | null }>) => {
    const byFrom = new Map<string, string[]>();
    for (const r of rows) {
      const from = r.from ?? client.id;
      byFrom.set(from, [...(byFrom.get(from) ?? []), r.id]);
    }
    for (const [from, ids] of Array.from(byFrom.entries()).sort(([a], [b]) => a.localeCompare(b))) {
      repoints.push({ type: "set_client", table, ids, fromClientId: from, clientRef: ref });
    }
  };

  add("transaction", related.transactions.map((r) => ({ id: r.id, from: r.clientId })));
  add("task", related.legacyTasks.map((r) => ({ id: r.id, from: r.clientId })));
  add("tasks", related.tasks.map((r) => ({ id: r.id, from: r.entityId })));
  add("tickets", related.tickets.map((r) => ({ id: r.id, from: r.clientId })));
  add("notes", related.notes.map((r) => ({ id: r.id, from: r.clientId })));

  return {
    copy: {
      type: "create_client_copy",
      ref,
      originalClientId: client.id,
      createdBy: userId,
      resetFields: CLIENT_COPY_RESET_FIELDS,
      branchRef: newBranchId,
    },
    repoints,
    counts: {
      transactions: related.transactions.length,
      tasks: related.tasks.length,
      legacyTasks: related.legacyTasks.length,
      tickets: related.tickets.length,
      notes: related.notes.length,
    },
  };
}

// ─── The planner ──────────────────────────────────────────────────────────────

type Side = { kind: "branch"; ref: BranchRef } | { kind: "shop" };

interface SplitGroup {
  userId: string;
  client: PlanClient;
  side: "homeworker" | "shop";
  branchRef: BranchRef | null;
  transactions: PlanTransaction[];
}

/** True when the org has any homeworker role row or membership (the runner skips orgs without). */
export function orgHasHomeworkers(input: Pick<OrgMigrationInput, "roleRows" | "memberships">): boolean {
  return (
    input.roleRows.some((r) => r.role === "homeworker") || input.memberships.some((m) => m.orgRole === "homeworker")
  );
}

export function planOrgMigration(input: OrgMigrationInput): MigrationPlan {
  const { org } = input;
  const operations: PlanOperation[] = [];
  const conflicts: Conflict[] = [];
  const addConflict = (kind: ConflictKind, message: string, userId?: string) => {
    conflicts.push({
      kind,
      severity: BLOCKING_CONFLICT_KINDS.includes(kind) ? "blocking" : "informational",
      userId,
      message,
    });
  };

  // Sorted once so every pass is deterministic.
  const transactions = [...input.transactions].sort(byId);
  const clients = [...input.clients].sort(byId);
  const tasks = [...input.tasks].sort(byId);
  const legacyTasks = [...input.legacyTasks].sort(byId);
  const tickets = [...input.tickets].sort(byId);
  const notes = [...input.notes].sort(byId);

  const userById = new Map(input.users.map((u) => [u.id, u] as const));
  const branchById = new Map(input.branches.map((b) => [b.id, b] as const));
  const clientById = new Map(clients.map((c) => [c.id, c] as const));
  const txnById = new Map(transactions.map((t) => [t.id, t] as const));
  const entityTxn = new Map((input.entityLinks ?? []).map((l) => [`${l.entityType}:${l.entityId}`, l.transactionId] as const));
  const multiOrg = new Set(input.multiOrgUserIds ?? []);

  // Pre-indexed so planning is linear in the number of rows.
  const rolesByUser = groupBy(input.roleRows, (r) => r.userId);
  const membershipsByUser = groupBy(input.memberships, (m) => m.userId);
  const clientsByCreator = groupBy(clients, (c) => c.createdBy);
  const txnsByUser = groupBy(transactions, (t) => t.userId);
  const tasksByUser = groupBy(tasks, (t) => t.userId);
  const legacyByUser = groupBy(legacyTasks, (t) => t.userId);
  const ticketsByUser = groupBy(tickets, (t) => t.userId);
  const legacyByClient = groupBy(legacyTasks, (t) => t.clientId);
  const ticketsByClient = groupBy(tickets, (t) => t.clientId);
  const notesByClient = groupBy(notes, (n) => n.clientId);
  const tasksByClientEntity = groupBy(tasks.filter((t) => t.entityType === "client"), (t) => t.entityId);

  const resolveClient = (id: string | null): PlanClient | undefined => {
    let c = id ? clientById.get(id) : undefined;
    for (let hops = 0; c && c.status === "merged" && c.mergedIntoId && hops < 5; hops++) c = clientById.get(c.mergedIntoId);
    return c && c.status !== "merged" ? c : undefined;
  };

  // Owners of existing homeworker branches are already migrated (idempotency).
  const existingOwnerBranch = new Map<string, string>();
  for (const b of input.branches) {
    if (b.branchType === "homeworker" && b.ownerUserId) existingOwnerBranch.set(b.ownerUserId, b.id);
  }

  // ── Step 1: find homeworkers ──
  const sources = new Map<string, Set<"role" | "membership">>();
  const addSource = (userId: string, source: "role" | "membership") => {
    const set = sources.get(userId) ?? new Set<"role" | "membership">();
    set.add(source);
    sources.set(userId, set);
  };
  for (const r of input.roleRows) if (r.role === "homeworker") addSource(r.userId, "role");
  for (const m of input.memberships) if (m.orgRole === "homeworker") addSource(m.userId, "membership");

  const foundIds = Array.from(sources.keys()).sort();
  const alreadyMigrated = foundIds.filter((id) => existingOwnerBranch.has(id));

  const skippedUsers: MigrationReport["skippedUsers"] = [];
  const migrating: string[] = [];
  for (const id of foundIds) {
    if (existingOwnerBranch.has(id)) continue;
    if (multiOrg.has(id)) {
      skippedUsers.push({ userId: id, reason: "multi_org_owner" });
      addConflict("multi_org_owner", `${id} holds the homeworker role in more than one org; owner_user_id is globally unique, so they are skipped.`, id);
      continue;
    }
    const blocked =
      (rolesByUser.get(id) ?? []).some((r) => ROLES_BLOCKING_HOMEWORKERS.includes(r.role)) ||
      (membershipsByUser.get(id) ?? []).some((m) => ROLES_BLOCKING_HOMEWORKERS.includes(m.orgRole));
    if (blocked) {
      skippedUsers.push({ userId: id, reason: "admin_or_manager_role" });
      addConflict("admin_or_manager_role", `${id} is a homeworker but also an org_admin or branch_manager; they are skipped and need a manual decision.`, id);
      continue;
    }
    migrating.push(id);
  }
  const migratingSet = new Set(migrating);

  const homeworkerBranchRef = (userId: string): BranchRef | null =>
    migratingSet.has(userId) ? newBranchRef(userId) : existingOwnerBranch.get(userId) ?? null;
  const isHomeworker = (userId: string): boolean => migratingSet.has(userId) || existingOwnerBranch.has(userId);

  const sideOfUser = (userId: string | null): Side => {
    const ref = userId ? homeworkerBranchRef(userId) : null;
    return ref ? { kind: "branch", ref } : { kind: "shop" };
  };

  // The org's default shop branch: where rows that were never homeworker data are re-homed.
  const shopBranches = input.branches.filter((b) => b.branchType === "shop" && b.isActive);
  const defaultShop = shopBranches.find((b) => b.isDefault) ?? shopBranches[0] ?? null;

  const legacyBranches = input.branches.filter((b) => b.branchType === "homeworker" && b.ownerUserId === null);
  const legacyIds = new Set(legacyBranches.map((b) => b.id));
  const resolveShopBranch = (branchId: string | null): BranchRef | null =>
    branchId && !legacyIds.has(branchId) ? branchId : defaultShop?.id ?? null;

  const report: MigrationReport = {
    orgId: org.id,
    homeworkersFound: foundIds.map((id) => {
      const u = userById.get(id);
      return { userId: id, name: homeworkerBranchName(u, id), email: u?.email ?? null, sources: Array.from(sources.get(id) ?? []).sort() };
    }),
    alreadyMigrated,
    skippedUsers,
    inactiveHomeworkers: [],
    branchesToCreate: [],
    branchRewrites: zeroRecord(BRANCH_TABLES),
    clientRepoints: zeroRecord(CLIENT_TABLES),
    clientSplits: [],
    clientMoves: [],
    homeworkersInShopBranches: [],
    roleRowsToDelete: [],
    legacyBranchesToArchive: [],
    legacyBranchesBlocked: [],
    legacyBranchResidue: [],
    agentTargetsSkipped: [],
    branchIdColumnsReviewed: BRANCH_ID_COLUMN_REVIEW.map((r) => ({ ...r })),
    conflicts,
  };

  if (migrating.length === 0 && legacyBranches.length === 0) {
    return { orgId: org.id, operations, report };
  }

  // ── Pass 1: which clients are split (copy) and which are moved ──
  const dealUsersByClient = new Map<string, Set<string>>();
  for (const t of transactions) {
    const c = resolveClient(t.clientId);
    if (!c) continue;
    const set = dealUsersByClient.get(c.id) ?? new Set<string>();
    set.add(t.userId);
    dealUsersByClient.set(c.id, set);
  }

  const groups = new Map<string, SplitGroup>();
  const movedClients = new Map<string, string>(); // client id -> homeworker user id
  for (const t of transactions) {
    const c = resolveClient(t.clientId);
    if (!c) continue;
    const userId = t.userId;
    const creator = c.createdBy;
    const creatorIsHw = creator !== null && isHomeworker(creator);
    const creatorMigrating = creator !== null && migratingSet.has(creator);
    if (!migratingSet.has(userId) && !creatorMigrating) continue;
    const userIsHw = isHomeworker(userId);
    if (userIsHw ? creator === userId : !creatorIsHw) continue; // already on the right side

    if (migratingSet.has(userId) && !creatorIsHw) {
      // Only this homeworker works the client and its creator is not a homeworker: move it.
      const others = Array.from(dealUsersByClient.get(c.id) ?? []).filter((u) => u !== userId);
      if (others.length === 0) {
        movedClients.set(c.id, userId);
        continue;
      }
    }

    const key = `${userId}:${c.id}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        userId,
        client: c,
        side: userIsHw ? "homeworker" : "shop",
        branchRef: userIsHw ? homeworkerBranchRef(userId) : resolveShopBranch(t.branchId ?? c.branchId),
        transactions: [],
      };
      groups.set(key, group);
    }
    group.transactions.push(t);
  }
  const sortedGroups = Array.from(groups.values()).sort((a, b) =>
    (a.userId + a.client.id).localeCompare(b.userId + b.client.id),
  );

  // Rows a split group re-points; claimed so a row never follows two copies.
  const repointClaims = new Map<string, string>();
  const mine = (table: ClientLinkTable, id: string, owner: string): boolean => {
    const key = `${table}:${id}`;
    const existing = repointClaims.get(key);
    if (existing === undefined) {
      repointClaims.set(key, owner);
      return true;
    }
    return existing === owner;
  };
  const repointedOwner = new Map<string, string>(); // `${table}:${id}` -> user who owns the copy
  const splitByGroup = new Map<SplitGroup, ClientSplitPlan>();
  for (const g of sortedGroups) {
    const owner = `${g.userId}:${g.client.id}`;
    const txnIds = new Set(g.transactions.map((t) => t.id));
    const related: ClientSplitRelatedRows = {
      transactions: g.transactions.filter((t) => mine("transaction", t.id, owner)),
      tasks: (tasksByClientEntity.get(g.client.id) ?? []).filter((t) => t.userId === g.userId && mine("tasks", t.id, owner)),
      legacyTasks: (legacyByClient.get(g.client.id) ?? []).filter(
        (t) => (t.userId === g.userId || (t.transactionId !== null && txnIds.has(t.transactionId))) && mine("task", t.id, owner),
      ),
      tickets: (ticketsByClient.get(g.client.id) ?? []).filter(
        (t) => (t.userId === g.userId || (t.transactionId !== null && txnIds.has(t.transactionId))) && mine("tickets", t.id, owner),
      ),
      notes: (notesByClient.get(g.client.id) ?? []).filter(
        (n) =>
          (n.userId === g.userId || n.agentId === g.userId || (n.transactionId !== null && txnIds.has(n.transactionId))) &&
          mine("notes", n.id, owner),
      ),
    };
    const split = planClientSplit(g.client, g.userId, g.branchRef, related);
    splitByGroup.set(g, split);
    for (const op of split.repoints) for (const id of op.ids) repointedOwner.set(`${op.table}:${id}`, g.userId);
  }
  const groupsByUser = groupBy(sortedGroups, (g) => g.userId);

  // ── Pass 2: decide every row's target branch (first decision wins) ──
  const assignments = new RowAssignments();
  const fillOrg = new Set<string>(); // `${table}:${id}` rows whose org column is NULL
  const assignedRows: Array<{ table: BranchTable; id: string; ref: BranchRef }> = [];
  const assignRow = (table: BranchTable, row: { id: string; branchId: string | null; orgId?: string | null }, ref: BranchRef) => {
    if (row.branchId === ref) return;
    if (!assignments.assign(table, row.id, ref)) {
      addConflict("row_claimed_twice", `${table} row ${row.id} was assigned to two different branches (${assignments.get(table, row.id)} and ${ref}); kept the first.`);
      return;
    }
    assignedRows.push({ table, id: row.id, ref });
    if (row.orgId === null) fillOrg.add(`${table}:${row.id}`);
  };
  const applySide = (table: BranchTable, row: { id: string; branchId: string | null; orgId?: string | null }, side: Side | null) => {
    if (side && side.kind === "branch") assignRow(table, row, side.ref);
  };

  const clientSide = (clientId: string | null): Side | null => {
    const c = resolveClient(clientId);
    if (!c) return null;
    const mover = movedClients.get(c.id);
    if (mover) return sideOfUser(mover);
    return sideOfUser(c.createdBy);
  };
  const txnSide = (transactionId: string | null): Side | null => {
    const t = transactionId ? txnById.get(transactionId) : undefined;
    return t ? sideOfUser(t.userId) : null;
  };

  // Clients: created by a migrating homeworker, or moved to one.
  for (const c of clients) {
    if (c.status === "merged") continue;
    const mover = movedClients.get(c.id);
    if (mover) {
      applySide("client_table", { ...c, orgId: c.orgId }, sideOfUser(mover));
      report.clientMoves.push({ clientId: c.id, userId: mover });
      addConflict("client_moved", `Client ${c.id} is only worked by ${mover}; it is moved to their branch (created_by kept) instead of copied.`, mover);
    } else if (c.createdBy && migratingSet.has(c.createdBy)) {
      applySide("client_table", { ...c, orgId: c.orgId }, sideOfUser(c.createdBy));
    }
  }
  // Transactions follow their owner.
  for (const t of transactions) if (migratingSet.has(t.userId)) applySide("transaction", t, sideOfUser(t.userId));

  // Tickets: copy side, else linked deal, else client, else creator.
  for (const t of tickets) {
    const copyOwner = repointedOwner.get(`tickets:${t.id}`);
    const side =
      (copyOwner ? sideOfUser(copyOwner) : null) ?? txnSide(t.transactionId) ?? clientSide(t.clientId) ?? sideOfUser(t.userId);
    applySide("tickets", t, side);
  }
  // Legacy tasks.
  for (const t of legacyTasks) {
    const copyOwner = repointedOwner.get(`task:${t.id}`);
    const side =
      (copyOwner ? sideOfUser(copyOwner) : null) ?? txnSide(t.transactionId) ?? clientSide(t.clientId) ?? sideOfUser(t.userId);
    applySide("task", t, side);
  }
  // New tasks: entity is a quote/enquiry/booking (resolved to its deal), a deal, or a client.
  for (const t of tasks) {
    const copyOwner = repointedOwner.get(`tasks:${t.id}`);
    let linkedTxn: string | null = null;
    let linkedClient: string | null = null;
    if (t.entityType === "client") linkedClient = t.entityId;
    else if (t.entityType === "quote" || t.entityType === "enquiry" || t.entityType === "booking") {
      linkedTxn = t.entityId ? entityTxn.get(`${t.entityType}:${t.entityId}`) ?? null : null;
    } else if (t.entityType === "transaction" || t.entityType === "deal") linkedTxn = t.entityId;
    const side =
      (copyOwner ? sideOfUser(copyOwner) : null) ?? txnSide(linkedTxn) ?? clientSide(linkedClient) ?? sideOfUser(t.userId);
    applySide("tasks", t, side);
  }

  // Agent targets: one row per (year, month) moves, the newest wins; the rest stay and are reported.
  const targetsByUser = groupBy(input.agentTargets, (t) => t.userId);
  const targetMoves = new Map<string, PlanAgentTarget[]>();
  for (const userId of migrating) {
    const mineTargets = [...(targetsByUser.get(userId) ?? [])].sort(
      (a, b) => (b.updatedAtMs ?? 0) - (a.updatedAtMs ?? 0) || a.id.localeCompare(b.id),
    );
    const kept = new Map<string, PlanAgentTarget>();
    for (const t of mineTargets) {
      const key = `${t.year}-${t.month}`;
      const winner = kept.get(key);
      if (!winner) {
        kept.set(key, t);
        continue;
      }
      report.agentTargetsSkipped.push({
        id: t.id, userId, year: t.year, month: t.month, amount: t.targetAmount ?? null, keptId: winner.id, keptAmount: winner.targetAmount ?? null,
      });
      addConflict(
        "agent_target_conflict",
        `${userId} has two targets for ${key}: kept ${winner.id} (${winner.targetAmount ?? "?"}), skipped ${t.id} (${t.targetAmount ?? "?"}).`,
        userId,
      );
    }
    targetMoves.set(userId, Array.from(kept.values()).sort(byId));
  }

  // ── Legacy shared branches: decide archive, residue rows and blocking reasons ──
  const residueTargets: Array<{ table: BranchTable; id: string; ref: BranchRef; branchId: string }> = [];
  const toArchive: PlanBranch[] = [];
  for (const b of legacyBranches) {
    if (!b.isActive) continue;
    const remaining = input.memberships
      .filter((m) => m.branchId === b.id && m.isActive && !migratingSet.has(m.userId))
      .map((m) => m.userId)
      .sort();
    let blockReason: string | null = null;
    if (b.isDefault) {
      blockReason = "it is the org default branch";
      addConflict("legacy_branch_is_default", `Legacy branch "${b.name}" is the org default and is not archived; change the default first.`);
    } else if (remaining.length > 0) {
      blockReason = `active members remain (${remaining.join(", ")})`;
      addConflict("legacy_branch_not_archivable", `Legacy branch "${b.name}" still has active members who are not being migrated (${remaining.join(", ")}); not archived.`);
    } else if (!defaultShop) {
      blockReason = "the org has no active shop branch to take the remaining rows";
      addConflict("no_default_shop_branch", `Legacy branch "${b.name}" cannot be archived: the org has no active shop branch to re-home its remaining rows.`);
    }

    const stillThere = (table: BranchTable, rows: Array<{ id: string; branchId: string | null }>) =>
      rows.filter((r) => r.branchId === b.id && assignments.get(table, r.id) === undefined);
    const residue = {
      client_table: stillThere("client_table", clients),
      transaction: stillThere("transaction", transactions),
      tasks: stillThere("tasks", tasks),
      task: stillThere("task", legacyTasks),
      tickets: stillThere("tickets", tickets),
    } as const;
    const total = Object.values(residue).reduce((n, rows) => n + rows.length, 0);

    if (blockReason === null && defaultShop) {
      for (const table of Object.keys(residue) as Array<keyof typeof residue>) {
        for (const r of residue[table]) residueTargets.push({ table, id: r.id, ref: defaultShop.id, branchId: b.id });
      }
      toArchive.push(b);
    } else {
      report.legacyBranchesBlocked.push({ branchId: b.id, name: b.name, reason: blockReason ?? "unknown", remainingMemberIds: remaining });
    }
    if (total > 0) {
      report.legacyBranchResidue.push({
        branchId: b.id,
        name: b.name,
        counts: {
          clients: residue.client_table.length,
          transactions: residue.transaction.length,
          tasks: residue.tasks.length,
          legacyTasks: residue.task.length,
          tickets: residue.tickets.length,
        },
        reassignedTo: blockReason === null ? defaultShop?.id ?? null : null,
      });
      addConflict(
        "legacy_branch_residue",
        `Legacy branch "${b.name}" still holds ${total} non-homeworker row(s)${blockReason === null ? `; they move to the default shop branch` : ` (left in place: ${blockReason})`}.`,
      );
    }
  }

  // Row lookups for emission (org column state).
  const rowsByTable: Record<Exclude<BranchTable, "agent_target_table">, Map<string, { orgId?: string | null }>> = {
    client_table: new Map(clients.map((r) => [r.id, r] as const)),
    transaction: new Map(transactions.map((r) => [r.id, r] as const)),
    tasks: new Map(tasks.map((r) => [r.id, r] as const)),
    task: new Map(legacyTasks.map((r) => [r.id, r] as const)),
    tickets: new Map(tickets.map((r) => [r.id, r] as const)),
  };

  const pushBranchOps = (ref: BranchRef, extra: Array<{ table: BranchTable; id: string; fill: boolean }>) => {
    for (const table of BRANCH_TABLES) {
      const rows = extra.filter((r) => r.table === table);
      if (rows.length === 0) continue;
      operations.push({
        type: "set_branch",
        table,
        ids: rows.map((r) => r.id),
        branchRef: ref,
        fillOrgIds: rows.filter((r) => r.fill).map((r) => r.id),
      });
      report.branchRewrites[table] += rows.length;
    }
  };
  const rowsFor = (ref: BranchRef) =>
    assignedRows
      .filter((r) => r.ref === ref)
      .map((r) => ({ table: r.table, id: r.id, fill: fillOrg.has(`${r.table}:${r.id}`) }));

  const emitSplit = (g: SplitGroup) => {
    const split = splitByGroup.get(g);
    if (!split) return;
    operations.push(split.copy);
    for (const op of split.repoints) {
      operations.push(op);
      report.clientRepoints[op.table] += op.ids.length;
    }
    report.clientSplits.push({ originalClientId: g.client.id, copyRef: split.copy.ref, userId: g.userId, side: g.side, counts: split.counts });
    addConflict(
      "client_split",
      `Client ${g.client.id} is shared: ${g.side} user ${g.userId} gets a copy (${split.copy.ref}); the original stays with ${g.client.createdBy ?? "its current side"}.`,
      g.userId,
    );
  };

  // ── Per homeworker: steps 1-4, 6 and 3 ──
  for (const userId of migrating) {
    const name = homeworkerBranchName(userById.get(userId), userId);
    const ref = newBranchRef(userId);

    // Extra sales/social roles: homeworker wins.
    const myRoleRows = rolesByUser.get(userId) ?? [];
    const extra = myRoleRows.filter((r) => ROLES_REMOVED_FROM_HOMEWORKERS.includes(r.role));
    if (extra.length > 0) {
      const roles = extra.map((r) => r.role).sort();
      operations.push({ type: "delete_role_rows", userId, roleRowIds: extra.map((r) => r.id), roles });
      report.roleRowsToDelete.push({ userId, roles });
      addConflict("extra_roles_removed", `${name} also holds ${roles.join(", ")}; those role rows are deleted (homeworker wins).`, userId);
    }
    if (!myRoleRows.some((r) => r.role === "homeworker")) {
      operations.push({ type: "insert_role_row", userId, role: "homeworker" });
    }

    // Step 2: the branch (contact fields stay empty, like onboarding).
    const profitSharePercent = normaliseShare(org.homeworkerCommission);
    operations.push({ type: "create_branch", ref, ownerUserId: userId, name, profitSharePercent });
    report.branchesToCreate.push({ ref, ownerUserId: userId, name, profitSharePercent });

    // Step 4: memberships. The new one is active only if they had an active one.
    const myMemberships = membershipsByUser.get(userId) ?? [];
    for (const m of myMemberships) {
      const b = branchById.get(m.branchId);
      if (m.isActive && b && b.branchType === "shop") {
        report.homeworkersInShopBranches.push({ userId, branchId: b.id, branchName: b.name });
        addConflict("homeworker_in_shop_branch", `${name} is an active member of shop branch "${b.name}"; that membership is removed.`, userId);
      }
    }
    const hadActive = myMemberships.some((m) => m.isActive);
    if (!hadActive) {
      const reason = myMemberships.length === 0 ? "no_membership" : "inactive_membership";
      report.inactiveHomeworkers.push({ userId, reason });
      addConflict("inactive_homeworker_carried_over", `${name} had no active membership (${reason}); their new membership is inserted inactive.`, userId);
    }
    if (myMemberships.length > 0) {
      operations.push({ type: "delete_memberships", userId, membershipIds: myMemberships.map((m) => m.id) });
    }
    operations.push({ type: "insert_membership", userId, branchRef: ref, orgRole: "homeworker", isActive: hadActive });
    operations.push({ type: "set_user_org_role", userId, orgRole: "homeworker" });

    // Step 6: copies come before rewrites so copy refs exist.
    for (const g of groupsByUser.get(userId) ?? []) emitSplit(g);

    // Step 3: branch_id rewrites assigned to this homeworker (+ their agent targets).
    const targetRows = (targetMoves.get(userId) ?? []).map((t) => ({ table: "agent_target_table" as const, id: t.id, fill: false }));
    pushBranchOps(ref, [...rowsFor(ref), ...targetRows]);
  }

  // Copies for users who stay as they are (shop staff, already-migrated homeworkers).
  for (const g of sortedGroups) if (!migratingSet.has(g.userId)) emitSplit(g);

  // Rows assigned to a branch that is not a new homeworker branch (e.g. an existing owner's).
  const otherRefs = Array.from(new Set(assignedRows.map((r) => r.ref).filter((ref) => !ref.startsWith("new-branch:")))).sort();
  for (const ref of otherRefs) pushBranchOps(ref, rowsFor(ref));

  // Residue of archivable legacy branches goes to the default shop branch.
  if (residueTargets.length > 0 && defaultShop) {
    pushBranchOps(
      defaultShop.id,
      residueTargets.map((r) => ({
        table: r.table,
        id: r.id,
        fill: rowsByTable[r.table as Exclude<BranchTable, "agent_target_table">].get(r.id)?.orgId === null,
      })),
    );
  }

  // ── Step 5: archive legacy shared branches last ──
  for (const b of toArchive) {
    operations.push({ type: "archive_branch", branchId: b.id });
    report.legacyBranchesToArchive.push({ branchId: b.id, name: b.name });
  }

  return { orgId: org.id, operations, report };
}

// ─── Report formatting ────────────────────────────────────────────────────────

export function formatReport(report: MigrationReport): string {
  const lines: string[] = [];
  const push = (s = "") => lines.push(s);

  push(`Organization ${report.orgId}`);
  push(`  Homeworkers found: ${report.homeworkersFound.length}`);
  for (const h of report.homeworkersFound) {
    const migrated = report.alreadyMigrated.includes(h.userId) ? " [already migrated, skipped]" : "";
    push(`    - ${h.name} <${h.email ?? "no email"}> (${h.userId}) via ${h.sources.join("+")}${migrated}`);
  }
  push(`  Skipped users: ${report.skippedUsers.length}`);
  for (const s of report.skippedUsers) push(`    - ${s.userId}: ${s.reason}`);
  push(`  Suspended/pending homeworkers (membership carried over inactive): ${report.inactiveHomeworkers.length}`);
  for (const s of report.inactiveHomeworkers) push(`    - ${s.userId}: ${s.reason}`);
  push(`  Branches to create: ${report.branchesToCreate.length}`);
  for (const b of report.branchesToCreate) push(`    - "${b.name}" owner ${b.ownerUserId} share ${b.profitSharePercent ?? "none"}`);
  push("  branch_id rewrites:");
  for (const t of BRANCH_TABLES) push(`    ${t}: ${report.branchRewrites[t]}`);
  push("  Client re-points (to copies):");
  for (const t of CLIENT_TABLES) push(`    ${t}: ${report.clientRepoints[t]}`);
  push(`  Client splits: ${report.clientSplits.length}`);
  for (const s of report.clientSplits) {
    const c = s.counts;
    push(`    - original ${s.originalClientId} -> ${s.copyRef} (${s.side}; txns ${c.transactions}, tasks ${c.tasks}, legacy tasks ${c.legacyTasks}, tickets ${c.tickets}, notes ${c.notes})`);
  }
  push(`  Client moves: ${report.clientMoves.length}`);
  for (const m of report.clientMoves) push(`    - client ${m.clientId} -> ${m.userId}`);
  push(`  Homeworkers in shop branches: ${report.homeworkersInShopBranches.length}`);
  for (const h of report.homeworkersInShopBranches) push(`    - ${h.userId} in "${h.branchName}" (${h.branchId})`);
  push(`  Role rows to delete: ${report.roleRowsToDelete.length}`);
  for (const r of report.roleRowsToDelete) push(`    - ${r.userId}: ${r.roles.join(", ")}`);
  push(`  Legacy shared branches to archive: ${report.legacyBranchesToArchive.length}`);
  for (const b of report.legacyBranchesToArchive) push(`    - "${b.name}" (${b.branchId})`);
  for (const b of report.legacyBranchesBlocked) push(`    - NOT ARCHIVED "${b.name}" (${b.branchId}): ${b.reason}`);
  for (const r of report.legacyBranchResidue) {
    const c = r.counts;
    push(`    - residue in "${r.name}": clients ${c.clients}, txns ${c.transactions}, tasks ${c.tasks}, legacy tasks ${c.legacyTasks}, tickets ${c.tickets}${r.reassignedTo ? ` -> ${r.reassignedTo}` : " (left in place)"}`);
  }
  push(`  Agent targets skipped (duplicates): ${report.agentTargetsSkipped.length}`);
  for (const t of report.agentTargetsSkipped) push(`    - ${t.id} ${t.year}-${t.month} amount ${t.amount ?? "?"} (kept ${t.keptId} amount ${t.keptAmount ?? "?"})`);
  push("  branch_id columns reviewed:");
  for (const r of report.branchIdColumnsReviewed) push(`    ${r.table}.${r.column}: ${r.decision} (${r.reason})`);

  const blocking = blockingConflicts(report);
  const info = informationalConflicts(report);
  push(`  BLOCKING conflicts: ${blocking.length}`);
  for (const c of blocking) push(`    [${c.kind}] ${c.message}`);
  push(`  Informational: ${info.length}`);
  for (const c of info) push(`    [${c.kind}] ${c.message}`);
  return lines.join("\n");
}
