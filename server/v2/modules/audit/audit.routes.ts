import { Router } from 'express';
import { auditController } from './audit.controller';
import { requireOrgRole } from '../../middlewares/auth/require-org-role';
import { validate } from '../../middlewares/validation.middleware';
import { deleteQuoteValidator, deleteBookingValidator } from './audit.validator';

const router = Router();

router.use(requireOrgRole(['org_admin', 'platform_admin']));

router.get('/', auditController.getAll);
router.post('/delete-quote/:id', validate(deleteQuoteValidator), auditController.deleteQuote);
router.post('/delete-booking/:id', validate(deleteBookingValidator), auditController.deleteBooking);

export default router;
