import { Router } from 'express';
import { auditController } from './audit.controller';
import { requireOrgRole } from '../../middlewares/auth/require-org-role';

const router = Router();

router.use(requireOrgRole(['org_admin', 'platform_admin']));

router.get('/', auditController.getAll);
router.post('/delete-quote/:id', auditController.deleteQuote);
router.post('/delete-booking/:id', auditController.deleteBooking);

export default router;
