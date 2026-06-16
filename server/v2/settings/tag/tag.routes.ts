import { Router } from 'express';
import { tagSettingsController } from './tag.controller';

const router = Router();

router.get('/', tagSettingsController.findAll);
router.get('/:id', tagSettingsController.findById);
router.post('/', tagSettingsController.create);
router.patch('/:id', tagSettingsController.update);
router.delete('/:id', tagSettingsController.remove);

export default router;
