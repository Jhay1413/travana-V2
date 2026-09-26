import { userRepository } from "./user.repository";
import { AppError } from "../../utils/error-handler";
import { db } from "../../config/database";
import { hrRecordsTable } from "@shared/schema";
import type { User, InsertUser } from "./user.types";
import { hasAnyRole, type Scope } from "../../utils/scope";

function effectiveOrgId(scope: Scope): string | null {
  return scope.orgRole === "platform_admin" ? null : (scope.orgId || null);
}

/**
 * Fields that gate authorization or account standing. A caller may only set
 * these on ANY target (including themselves) when they are a platform_admin.
 * Dedicated, audited flows already exist for changing them legitimately:
 *   - `role`/`orgRole`: the org-role endpoints (user-org-roles, platform-admin
 *     "change role") apply compatibility/seat-limit rules and write an audit
 *     row; setting them through this generic partial-update would bypass all
 *     of that and, for `role`, can grant cross-tenant platform_admin access.
 *   - `banned`/`banReason`/`banExpires`: the platform-admin deactivate/
 *     reactivate endpoints own this and audit it.
 *   - `email`: the better-auth login identity; this endpoint has no
 *     re-verification/session-sync side effect, so letting it through here
 *     could silently break login or let a caller relabel another account.
 * A rejection here throws instead of silently stripping the field: a silent
 * strip would make a failed role-escalation attempt look like a successful
 * save to whatever client (including an admin tool) issued the request.
 */
const PRIVILEGED_FIELDS = ["role", "orgRole", "email", "banned", "banReason", "banExpires"] as const;

/**
 * Fields an ordinary (non-platform_admin) caller may set on their OWN user
 * record. Everything else on a self-edit is silently dropped rather than
 * rejected: e.g. omitting `orgName` or `percentageCommission` from a profile
 * save isn't a security violation, just outside the scope of self-service,
 * so failing loudly would only be user-hostile noise.
 */
const SELF_EDITABLE_FIELDS = ["name", "image", "firstName", "lastName", "phoneNumber"] as const;

function assertNoPrivilegedFields(data: Partial<InsertUser>, scope: Scope): void {
  if (hasAnyRole(scope.orgRoles, ["platform_admin"])) return;
  const attempted = PRIVILEGED_FIELDS.filter((field) => field in data);
  if (attempted.length > 0) {
    throw new AppError(`Insufficient privilege to modify field(s): ${attempted.join(", ")}`, 403);
  }
}

function restrictToSelfEditableFields(data: Partial<InsertUser>): Partial<InsertUser> {
  const allowed: Partial<InsertUser> = {};
  for (const field of SELF_EDITABLE_FIELDS) {
    if (field in data) {
      (allowed as Record<string, unknown>)[field] = data[field];
    }
  }
  return allowed;
}

async function loadScopedUser(id: string, scope: Scope): Promise<User> {
  const target = await userRepository.findById(id);
  if (!target) throw new AppError("User not found", 404);
  const callerOrgId = effectiveOrgId(scope);
  if (callerOrgId && target.orgId !== callerOrgId) {
    throw new AppError("User not found", 404);
  }
  return target;
}

export const userService = {
  async listUsers(scope?: Scope, opts?: { salesAgentsOnly?: boolean }): Promise<User[]> {
    return userRepository.findAll(scope, opts);
  },

  async getUserById(id: string, scope: Scope): Promise<User> {
    return loadScopedUser(id, scope);
  },

  async createUser(userData: InsertUser, scope: Scope): Promise<User> {
    const callerOrgId = effectiveOrgId(scope);
    const data: InsertUser = callerOrgId
      ? { ...userData, orgId: callerOrgId }
      : userData;
    const created = await userRepository.create(data);
    if (created.orgId) {
      await db
        .insert(hrRecordsTable)
        .values({ orgId: created.orgId, userId: created.id })
        .onConflictDoNothing({ target: hrRecordsTable.userId });
    }
    return created;
  },

  async updateUser(id: string, data: Partial<InsertUser>, scope: Scope): Promise<User> {
    await loadScopedUser(id, scope);
    assertNoPrivilegedFields(data, scope);

    const isPlatformAdmin = hasAnyRole(scope.orgRoles, ["platform_admin"]);
    const isSelf = scope.userId === id;
    const scopedData = isSelf && !isPlatformAdmin ? restrictToSelfEditableFields(data) : data;

    const callerOrgId = effectiveOrgId(scope);
    const safeData = callerOrgId ? { ...scopedData, orgId: callerOrgId } : scopedData;
    // `id` is the primary key — it must only ever come from the URL param,
    // never from the request body (changing it would repoint every FK that
    // references this row and can only ever error or corrupt data).
    const { id: _ignoredId, ...persistable } = safeData as Partial<InsertUser> & { id?: string };
    const user = await userRepository.update(id, persistable);
    if (!user) throw new AppError("User not found", 404);
    return user;
  },

  async deleteUser(id: string, scope: Scope): Promise<void> {
    await loadScopedUser(id, scope);
    await userRepository.remove(id);
  },
};
