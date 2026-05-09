import { Router } from 'express';
import { cottageSettingsController } from './cottage.controller';

const router = Router();

router.get('/', cottageSettingsController.findAll);
router.get('/:id', cottageSettingsController.findById);
router.post('/', cottageSettingsController.create);
router.patch('/:id', cottageSettingsController.update);
router.delete('/:id', cottageSettingsController.remove);

export default router;
