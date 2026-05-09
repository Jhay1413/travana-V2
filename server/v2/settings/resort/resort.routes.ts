import { Router } from 'express';
import { resortSettingsController } from './resort.controller';

const router = Router();
router.get('/', resortSettingsController.list);
router.get('/:id', resortSettingsController.getById);
router.post('/', resortSettingsController.create);
router.patch('/:id', resortSettingsController.update);
router.delete('/:id', resortSettingsController.remove);
export default router;
