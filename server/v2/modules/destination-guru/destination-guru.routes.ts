import { Router } from 'express';
import { destinationGuruController } from './destination-guru.controller';
import { requireOrgRole } from '../../middlewares/auth/require-org-role';

// Destination guru entries are a global content library shared across all orgs.
// Reads stay open; generate + delete (which mutate the shared library) require
// org_admin or platform_admin.
const router = Router();

router.get('/', destinationGuruController.getAll);
router.get('/search/:destination', destinationGuruController.getByDestination);
router.get('/:id', destinationGuruController.getById);

router.post('/generate', requireOrgRole(['org_admin', 'platform_admin']), destinationGuruController.generate);
router.delete('/:id', requireOrgRole(['org_admin', 'platform_admin']), destinationGuruController.remove);

export default router;
