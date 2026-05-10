import { Router } from 'express';
import { inviteController } from './invite.controller';
import { isAuthenticated } from '../../middlewares/auth';
import { orgBranchScope } from '../../middlewares/org-branch-scope';
import { requireOrgRole } from '../../middlewares/auth/require-org-role';
import { validate } from '../../middlewares/validation.middleware';
import {
  sendInviteSchema,
  acceptInviteQuerySchema,
  acceptInviteSubmitSchema,
} from './invite.validator';

const router = Router();

// Branch managers can also send/manage invites (service scopes them to their own branch)
const inviterRoles = requireOrgRole(['org_admin', 'platform_admin', 'branch_manager']);

// Public — invitee uses these to set up their account (no auth, just token)
router.get('/accept',  validate(acceptInviteQuerySchema),  inviteController.accept);
router.post('/accept', validate(acceptInviteSubmitSchema), inviteController.acceptSubmit);

// Org admin or branch manager (server enforces branch scoping for managers)
router.get('/',                isAuthenticated, orgBranchScope, inviterRoles, inviteController.list);
router.post('/',               isAuthenticated, orgBranchScope, inviterRoles, validate(sendInviteSchema), inviteController.send);
router.post('/:userId/resend', isAuthenticated, orgBranchScope, inviterRoles, inviteController.resend);
router.delete('/:userId',      isAuthenticated, orgBranchScope, inviterRoles, inviteController.revoke);

export default router;
