import { Router } from 'express';
import { clientPassengerController } from './client-passenger.controller';
import { validate } from '../../middlewares/validation.middleware';
import { blockReadOnlyClientRoles } from '../../middlewares/auth/block-read-only-roles';
import {
  clientParamsValidator,
  passengerParamsValidator,
  setLeadPassportValidator,
  createPassengerValidator,
  updatePassengerValidator,
} from './client-passenger.validator';

// Mounted at /neon-clients/:clientId/passengers (see routes/index.ts).
const router = Router({ mergeParams: true });

router.get('/', validate(clientParamsValidator), clientPassengerController.list);
// Registered before '/:passengerId' so 'lead' is not read as an id.
router.put('/lead', blockReadOnlyClientRoles, validate(setLeadPassportValidator), clientPassengerController.setLead);
router.post('/', blockReadOnlyClientRoles, validate(createPassengerValidator), clientPassengerController.create);
router.patch('/:passengerId', blockReadOnlyClientRoles, validate(updatePassengerValidator), clientPassengerController.update);
router.delete('/:passengerId', blockReadOnlyClientRoles, validate(passengerParamsValidator), clientPassengerController.remove);

export default router;
