import { Router } from 'express';
import { feedbackController } from './feedback.controller';
import { requireOrgRole } from '../../middlewares/auth/require-org-role';

// Feedback is global by design (any user submits, all admins triage).
// Reads + own-submission stay open; status updates and deletes require
// org_admin or platform_admin to prevent regular users from triaging or
// deleting other users' feedback.
const router = Router();

router.get('/', feedbackController.getAll);
router.get('/mine', feedbackController.getMine);
router.post('/', feedbackController.create);

router.patch('/:id/status', requireOrgRole(['org_admin', 'platform_admin']), feedbackController.updateStatus);
router.delete('/:id', requireOrgRole(['org_admin', 'platform_admin']), feedbackController.remove);

export default router;
