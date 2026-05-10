import { Router } from 'express';
import { organizationController } from './organization.controller';
import { orgMemberController } from './organization-member.controller';
import { isAuthenticated } from '../../middlewares/auth';
import { orgBranchScope } from '../../middlewares/org-branch-scope';
import { requireOrgRole } from '../../middlewares/auth/require-org-role';
import { validate } from '../../middlewares/validation.middleware';
import { updateOrganizationSchema } from './organization.validator';

const router = Router();

const platformOnly = requireOrgRole(['platform_admin']);
const adminOnly = requireOrgRole(['org_admin', 'platform_admin']);
// Read-only org context — admins + branch managers (managers see members for context, can't mutate)
const teamReadRoles = requireOrgRole(['org_admin', 'platform_admin', 'branch_manager']);

// Current-org endpoints (org_admin scope)
router.get('/me',                   isAuthenticated, orgBranchScope, organizationController.getMine);
router.patch('/me',                 isAuthenticated, orgBranchScope, adminOnly, validate(updateOrganizationSchema), organizationController.updateMine);

// Org members (team page) — branch managers can read; only admins mutate
router.get('/me/members',           isAuthenticated, orgBranchScope, teamReadRoles, orgMemberController.list);
router.patch('/me/members/:userId/role',     isAuthenticated, orgBranchScope, adminOnly, orgMemberController.updateRole);
router.patch('/me/members/:userId/suspended', isAuthenticated, orgBranchScope, adminOnly, orgMemberController.setSuspended);
router.post('/me/members/:userId/branches',  isAuthenticated, orgBranchScope, adminOnly, orgMemberController.assignBranch);
router.delete('/me/members/:userId/branches/:branchId', isAuthenticated, orgBranchScope, adminOnly, orgMemberController.unassignBranch);

// Platform-admin only — full org listing/CRUD
router.get('/',     isAuthenticated, orgBranchScope, platformOnly, organizationController.list);
router.get('/:id',  isAuthenticated, orgBranchScope, platformOnly, organizationController.getById);
router.post('/',    isAuthenticated, orgBranchScope, platformOnly, organizationController.create);
router.patch('/:id',isAuthenticated, orgBranchScope, platformOnly, organizationController.update);
router.delete('/:id',isAuthenticated, orgBranchScope, platformOnly, organizationController.remove);

export default router;
