import { AppError } from "./error-handler";
import type { Scope } from "./scope";

interface OwnershipFields {
  orgId?: string | null;
  branchId?: string | null;
  createdBy?: string | null;
}

/**
 * Removes tenancy/ownership fields a request body must not control:
 *  - orgId is always dropped (it comes from the caller's scope)
 *  - branchId and createdBy are dropped for non-admins
 *  - an org_admin / platform_admin may set branchId, but only to a branch of their
 *    own org (checked through `branchExistsInOrg`, a 400 otherwise). A platform_admin
 *    with no org context cannot be validated, so their branchId is dropped too.
 */
export async function stripOwnershipFields<T extends OwnershipFields>(
  data: T,
  scope: Scope,
  branchExistsInOrg: (branchId: string, orgId: string) => Promise<boolean>,
): Promise<Omit<T, "orgId" | "branchId" | "createdBy"> & { branchId?: string }> {
  const { orgId: _orgId, branchId, createdBy: _createdBy, ...rest } = data;
  const isAdmin = scope.orgRole === "org_admin" || scope.orgRole === "platform_admin";
  if (!isAdmin || !branchId || !scope.orgId) return rest;
  if (!(await branchExistsInOrg(branchId, scope.orgId))) {
    throw new AppError("Branch not found in this organisation", 400);
  }
  return { ...rest, branchId };
}
