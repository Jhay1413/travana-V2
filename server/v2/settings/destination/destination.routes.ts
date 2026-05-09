import { Router } from 'express';
import { destinationSettingsController } from './destination.controller';

const router = Router();

router.get('/', destinationSettingsController.list);
router.get('/:id', destinationSettingsController.getById);
router.post('/', destinationSettingsController.create);
router.patch('/:id', destinationSettingsController.update);
router.delete('/:id', destinationSettingsController.remove);

export default router;
