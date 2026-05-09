import { Router } from 'express';
import { neonClientController } from './neon-client.controller';
import { validate } from '../../middlewares/validation.middleware';
import {
  createNeonClientValidator,
  updateNeonClientValidator,
  importNeonClientsValidator,
} from './neon-client.validator';

const router = Router();

router.get('/', neonClientController.listNeonClients);
router.get('/:id', neonClientController.getNeonClientById);
router.post('/', validate(createNeonClientValidator), neonClientController.createNeonClient);
router.post('/import', validate(importNeonClientsValidator), neonClientController.importNeonClients);
router.patch('/:id', validate(updateNeonClientValidator), neonClientController.updateNeonClient);
router.delete('/:id', neonClientController.deleteNeonClient);

export default router;
