import type { OrgRole } from "./scope";

/** Roles allowed to delete a client, and to still READ a soft-deleted client (read-only). */
export const CLIENT_DELETE_ROLES: readonly OrgRole[] = ["org_admin", "platform_admin"];

/**
 * Read gate for deleted clients: only CLIENT_DELETE_ROLES may open a soft-deleted client's data.
 * Used by READ paths only (notes, tasks, files lists); every write path keeps the strict lookup.
 */
export function canReadDeletedClients(scope: { orgRole?: string | null }): boolean {
  return CLIENT_DELETE_ROLES.includes((scope.orgRole ?? "") as OrgRole);
}
