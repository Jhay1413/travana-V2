import { Router } from 'express';
import { destinationGuruController } from './destination-guru.controller';
import { requireOrgRole } from '../../middlewares/auth/require-org-role';
import { validate } from '../../middlewares/validation.middleware';
import { generateDestinationGuruValidator, idParamValidator, updateCoordinatesValidator } from './destination-guru.validator';

// Destination guru entries are a global content library shared across all orgs.
// Reads stay open; generate + delete + coordinate edits (which mutate the
// shared library) require org_admin or platform_admin.
const router = Router();

router.get('/', destinationGuruController.getAll);
// Must stay ahead of GET /:id so "search" isn't swallowed as an :id value.
router.get('/search/:destination', destinationGuruController.getByDestination);
router.get('/:id', validate(idParamValidator), destinationGuruController.getById);

router.post(
  '/generate',
  requireOrgRole(['org_admin', 'platform_admin']),
  validate(generateDestinationGuruValidator),
  destinationGuruController.generate,
);
router.patch(
  '/:id/coordinates',
  requireOrgRole(['org_admin', 'platform_admin']),
  validate(updateCoordinatesValidator),
  destinationGuruController.updateCoordinates,
);
router.delete(
  '/:id',
  requireOrgRole(['org_admin', 'platform_admin']),
  validate(idParamValidator),
  destinationGuruController.remove,
);

export default router;
