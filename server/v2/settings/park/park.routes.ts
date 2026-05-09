import { Router } from 'express';
import { parkSettingsController } from './park.controller';

const router = Router();

router.get('/', parkSettingsController.findAll);
router.get('/:id', parkSettingsController.findById);
router.post('/', parkSettingsController.create);
router.patch('/:id', parkSettingsController.update);
router.delete('/:id', parkSettingsController.remove);

export default router;
