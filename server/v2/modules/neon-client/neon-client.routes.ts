import { Router } from 'express';
import { neonClientController } from './neon-client.controller';
import { validate } from '../../middlewares/validation.middleware';
import { requireOrgRole } from '../../middlewares/auth/require-org-role';
import {
  createNeonClientValidator,
  updateNeonClientValidator,
  importNeonClientsValidator,
  mergeNeonClientValidator,
  duplicatePhoneGroupValidator,
  mergeDuplicateGroupValidator,
} from './neon-client.validator';

const router = Router();

// Duplicate resolution is admin-only: it reads every client on a number
// regardless of who owns them, and folding the wrong records together is not
// undoable from the app. The module is mounted with orgBranchScope (see
// routes/index.ts), so req.orgRole is populated by the time this runs.
const adminOnly = requireOrgRole(['org_admin', 'platform_admin']);

router.get('/', neonClientController.listNeonClients);
// Registered before '/:id' — Express matches in order, so a literal path
// declared after the param route would be swallowed by it.
router.get('/duplicates/phone', adminOnly, neonClientController.listDuplicatePhoneGroups);
router.get(
  '/duplicates/phone/:phoneKey',
  adminOnly,
  validate(duplicatePhoneGroupValidator),
  neonClientController.getDuplicatePhoneGroup,
);
router.get('/:id', neonClientController.getNeonClientById);
router.post('/', validate(createNeonClientValidator), neonClientController.createNeonClient);
router.post('/import', validate(importNeonClientsValidator), neonClientController.importNeonClients);
// ':id' is the SOURCE (duplicate) client; body.targetId is the survivor.
router.post('/:id/merge', validate(mergeNeonClientValidator), neonClientController.mergeNeonClient);
// ':id' is the MAIN client to keep; body.sourceIds are the duplicates folded into it.
router.post(
  '/:id/merge-duplicates',
  adminOnly,
  validate(mergeDuplicateGroupValidator),
  neonClientController.mergeDuplicateGroup,
);
router.patch('/:id', validate(updateNeonClientValidator), neonClientController.updateNeonClient);
router.delete('/:id', neonClientController.deleteNeonClient);

export default router;
