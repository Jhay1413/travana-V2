import { Router } from 'express';
import { cruiseVoyageSettingsController } from './cruise-voyage.controller';

const router = Router();

router.get('/', cruiseVoyageSettingsController.findAll);
router.get('/:id', cruiseVoyageSettingsController.findById);
router.post('/', cruiseVoyageSettingsController.create);
router.patch('/:id', cruiseVoyageSettingsController.update);
router.delete('/:id', cruiseVoyageSettingsController.remove);

export default router;
