import { Router } from 'express';
import { roomTypeSettingsController } from './room-type.controller';

const router = Router();

router.get('/', roomTypeSettingsController.findAll);
router.get('/:id', roomTypeSettingsController.findById);
router.post('/', roomTypeSettingsController.create);
router.patch('/:id', roomTypeSettingsController.update);
router.delete('/:id', roomTypeSettingsController.remove);

export default router;
