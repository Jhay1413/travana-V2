import { Router } from 'express';
import { airportController } from './airport.controller';
import { requireAnyOrgRole } from '../../middlewares/auth/require-org-role';
import { validate } from '../../middlewares/validation.middleware';
import { ADMIN_ROLES, EVERYDAY_WRITER_ROLES } from '../../settings/settings-write-guard';
import { createAirportSchema, deleteAirportSchema } from './airport.validator';

const router = Router();

// This router writes the same shared airport table as /settings/airports, so it
// follows the same rules: the quote and enquiry forms quick-add an airport (POST,
// everyday staff roles), but removing one is an admin job.
router.get('/', airportController.listAirports);
router.post('/', requireAnyOrgRole(EVERYDAY_WRITER_ROLES), validate(createAirportSchema), airportController.createAirport);
router.delete('/:id', requireAnyOrgRole(ADMIN_ROLES), validate(deleteAirportSchema), airportController.deleteAirport);

export default router;
