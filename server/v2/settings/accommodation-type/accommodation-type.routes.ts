import { Router } from 'express';
import { accommodationTypeSettingsController } from './accommodation-type.controller';

const router = Router();

router.get('/', accommodationTypeSettingsController.findAll);
router.get('/:id', accommodationTypeSettingsController.findById);
router.post('/', accommodationTypeSettingsController.create);
router.patch('/:id', accommodationTypeSettingsController.update);
router.delete('/:id', accommodationTypeSettingsController.remove);

export default router;
