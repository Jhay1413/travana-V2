import { Router } from 'express';
import { tourOperatorSettingsController } from './tour-operator-settings.controller';

const router = Router();

router.get('/', tourOperatorSettingsController.findAll);
router.get('/:id', tourOperatorSettingsController.findById);
router.post('/', tourOperatorSettingsController.create);
router.patch('/:id', tourOperatorSettingsController.update);
router.delete('/:id', tourOperatorSettingsController.remove);

export default router;
