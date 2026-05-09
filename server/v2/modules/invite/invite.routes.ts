import { Router } from 'express';
import { inviteController } from './invite.controller';
import { isAuthenticated } from '../../middlewares/auth';
import { orgBranchScope } from '../../middlewares/org-branch-scope';

const router = Router();

router.post('/',              isAuthenticated, orgBranchScope, inviteController.send);
router.get('/accept',         inviteController.accept);
router.post('/accept',        inviteController.acceptSubmit);
router.get('/',               isAuthenticated, orgBranchScope, inviteController.list);
router.delete('/:id/revoke',  isAuthenticated, orgBranchScope, inviteController.revoke);

export default router;
