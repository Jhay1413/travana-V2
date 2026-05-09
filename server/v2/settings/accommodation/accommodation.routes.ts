import { Router } from 'express';
import { accommodationSettingsController } from './accommodation.controller';

const router = Router();

router.get('/', accommodationSettingsController.findAll);
router.get('/:id', accommodationSettingsController.findById);
router.post('/', accommodationSettingsController.create);
router.patch('/:id', accommodationSettingsController.update);
router.delete('/:id', accommodationSettingsController.remove);

export default router;
