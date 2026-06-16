import { Router } from 'express';
import { packageTypeSettingsController } from './package-type.controller';

const router = Router();

router.get('/', packageTypeSettingsController.findAll);
router.get('/:id', packageTypeSettingsController.findById);
router.post('/', packageTypeSettingsController.create);
router.patch('/:id', packageTypeSettingsController.update);
router.delete('/:id', packageTypeSettingsController.remove);

export default router;
