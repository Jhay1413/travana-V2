import { Router } from 'express';
import { deletionCodeSettingsController } from './deletion-code.controller';

const router = Router();

router.get('/', deletionCodeSettingsController.findAll);
router.get('/:id', deletionCodeSettingsController.findById);
router.post('/', deletionCodeSettingsController.create);
router.patch('/:id', deletionCodeSettingsController.update);
router.delete('/:id', deletionCodeSettingsController.remove);

export default router;
