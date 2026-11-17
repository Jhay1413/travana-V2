import { Router } from 'express';
import { parkSettingsController } from './park.controller';
import { validate } from '../../middlewares/validation.middleware';
import { createParkValidator, updateParkValidator, parkIdValidator } from './park.validator';

const router = Router();

router.get('/', parkSettingsController.findAll);
router.get('/:id', validate(parkIdValidator), parkSettingsController.findById);
router.post('/', validate(createParkValidator), parkSettingsController.create);
router.patch('/:id', validate(updateParkValidator), parkSettingsController.update);
router.delete('/:id', validate(parkIdValidator), parkSettingsController.remove);

export default router;
