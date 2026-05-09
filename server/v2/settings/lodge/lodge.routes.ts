import { Router } from 'express';
import { lodgeSettingsController } from './lodge.controller';

const router = Router();

router.get('/', lodgeSettingsController.findAll);
router.get('/:id', lodgeSettingsController.findById);
router.post('/', lodgeSettingsController.create);
router.patch('/:id', lodgeSettingsController.update);
router.delete('/:id', lodgeSettingsController.remove);

export default router;
