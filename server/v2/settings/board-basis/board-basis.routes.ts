import { Router } from 'express';
import { boardBasisSettingsController } from './board-basis.controller';

const router = Router();

router.get('/', boardBasisSettingsController.findAll);
router.get('/:id', boardBasisSettingsController.findById);
router.post('/', boardBasisSettingsController.create);
router.patch('/:id', boardBasisSettingsController.update);
router.delete('/:id', boardBasisSettingsController.remove);

export default router;
