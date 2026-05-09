import { Router } from 'express';
import { platformAdminController } from './platform-admin.controller';
import { isAuthenticated } from '../../middlewares/auth';

const isPlatformAdmin = isAuthenticated; // TODO: add role = platform_admin guard

const router = Router();
router.use(isPlatformAdmin);

router.get('/organizations',               platformAdminController.listOrgs);
router.get('/organizations/:id',           platformAdminController.getOrg);
router.patch('/organizations/:id/suspend', platformAdminController.suspend);
router.patch('/organizations/:id/activate',platformAdminController.activate);
router.patch('/organizations/:id/plan',    platformAdminController.changePlan);
router.post('/organizations/:id/impersonate', platformAdminController.impersonate);

export default router;
