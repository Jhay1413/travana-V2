import { Router } from 'express';
import { airportSettingsController } from './airport.controller';

const router = Router();

router.get('/', airportSettingsController.findAll);
router.get('/:id', airportSettingsController.findById);
router.post('/', airportSettingsController.create);
router.patch('/:id', airportSettingsController.update);
router.delete('/:id', airportSettingsController.remove);

export default router;
