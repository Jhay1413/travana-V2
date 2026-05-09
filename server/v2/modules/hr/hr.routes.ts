import { Router } from 'express';
import { hrController, requireHrRole } from './hr.controller';

const router = Router();

router.use(requireHrRole);

router.get('/employees', hrController.listEmployees);
router.get('/employees/:id', hrController.getEmployee);
router.get('/reminders', hrController.listReminders);
router.post('/employees/:id/leave/approve', hrController.approveLeave);
router.post('/employees/:id/leave/reject', hrController.rejectLeave);
router.post('/employees/:id/notes', hrController.addNote);
router.post('/employees/:id/onboarding/toggle', hrController.toggleOnboarding);
router.post('/employees/:id/documents', hrController.uploadDocument);

export default router;
