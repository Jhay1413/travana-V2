import { Router } from 'express';
import { lodgeSettingsController } from './lodge.controller';
import { validate } from '../../middlewares/validation.middleware';
import { createLodgeValidator, updateLodgeValidator, lodgeIdValidator } from './lodge.validator';

const router = Router();

router.get('/', lodgeSettingsController.findAll);
router.get('/:id', validate(lodgeIdValidator), lodgeSettingsController.findById);
router.post('/', validate(createLodgeValidator), lodgeSettingsController.create);
router.patch('/:id', validate(updateLodgeValidator), lodgeSettingsController.update);
router.delete('/:id', validate(lodgeIdValidator), lodgeSettingsController.remove);

export default router;
