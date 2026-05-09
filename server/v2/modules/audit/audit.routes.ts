import { Router } from 'express';
import { auditController } from './audit.controller';

const router = Router();

router.get('/', auditController.getAll);
router.post('/delete-quote/:id', auditController.deleteQuote);
router.post('/delete-booking/:id', auditController.deleteBooking);

export default router;
