import { Router } from 'express';
import { countrySettingsController } from './country.controller';

const router = Router();

router.get('/', countrySettingsController.findAll);
router.get('/:id', countrySettingsController.findById);
router.post('/', countrySettingsController.create);
router.patch('/:id', countrySettingsController.update);
router.delete('/:id', countrySettingsController.remove);

export default router;
