import { AppError } from '../../utils/error-handler';
import { hasAnyRole, type OrgRole, type Scope } from '../../utils/scope';

/** Roles that may add, edit, delete and import operators. */
export const OPERATOR_WRITER_ROLES: OrgRole[] = ['platform_admin', 'org_admin', 'branch_manager'];

/** Roles that may open the Tour operators page (social media managers may not). */
export const OPERATOR_READER_ROLES: OrgRole[] = ['platform_admin', 'org_admin', 'branch_manager', 'agent', 'homeworker'];

/** GET / (credential-free dropdown options) is also open to social media managers, whose quote forms pick an operator. */
export const OPERATOR_OPTION_ROLES: OrgRole[] = [...OPERATOR_READER_ROLES, 'social_media_manager'];

type RoleScope = Pick<Scope, 'orgRoles'>;

/** Fail closed: every operation here is tenant-scoped, so no org means no access. */
export function requireOrg(scope: Pick<Scope, 'orgId'>): string {
  if (!scope.orgId) throw new AppError('Select an organisation first', 403);
  return scope.orgId;
}

export function canWriteOperators(scope: RoleScope): boolean {
  return hasAnyRole(scope.orgRoles, OPERATOR_WRITER_ROLES);
}

export function canSeeOperatorPasswords(scope: RoleScope): boolean {
  return hasAnyRole(scope.orgRoles, OPERATOR_WRITER_ROLES);
}

/** 403 unless the caller may write. Used by every mutating service call (defence in depth). */
export function requireWriter(scope: RoleScope): void {
  if (!canWriteOperators(scope)) throw new AppError('You do not have permission to perform this action', 403);
}

/** 403 unless the caller may fetch the dropdown options. */
export function requireOptionReader(scope: RoleScope): void {
  if (!hasAnyRole(scope.orgRoles, OPERATOR_OPTION_ROLES)) {
    throw new AppError('You do not have permission to perform this action', 403);
  }
}

/** 403 unless the caller may open the page at all (everyone but social media managers / referral agents). */
export function requireReader(scope: RoleScope): void {
  if (!hasAnyRole(scope.orgRoles, OPERATOR_READER_ROLES)) {
    throw new AppError('You do not have permission to perform this action', 403);
  }
}
