import { Router } from 'express';
import { cruiseExtraSettingsController } from './cruise-extra.controller';

const router = Router();

router.get('/', cruiseExtraSettingsController.findAll);
router.get('/:id', cruiseExtraSettingsController.findById);
router.post('/', cruiseExtraSettingsController.create);
router.patch('/:id', cruiseExtraSettingsController.update);
router.delete('/:id', cruiseExtraSettingsController.remove);

export default router;
