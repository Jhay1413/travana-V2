import { Router } from 'express';
import { validate } from '../../middlewares/validation.middleware';
import { jsonMapperController } from './json-mapper.controller';
import { mapToIdsValidator } from './json-mapper.validator';

const router = Router();

// Open to every signed-in role (social media managers import scraped quotes daily).
// canWrite in the controller stops non-writers creating operators or links.
router.post('/map-to-ids', validate(mapToIdsValidator), jsonMapperController.mapToIds);

export default router;
