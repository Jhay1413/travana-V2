import { Router } from 'express';
import { adminImportController } from './admin-import.controller';
import { requireOrgRole } from '../../middlewares/auth/require-org-role';

const router = Router();

router.use(requireOrgRole(['platform_admin']));

router.get('/tables', adminImportController.getTables);
router.get('/data/:tableName', adminImportController.getData);
router.post('/data/:tableName', adminImportController.createRow);
router.patch('/data/:tableName/:id', adminImportController.updateRow);
router.delete('/data/:tableName/:id', adminImportController.deleteRow);
router.post('/import/:tableName', adminImportController.importRows);
router.delete('/clear/:tableName', adminImportController.clearTable);

export default router;
