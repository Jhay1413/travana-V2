import { Router } from 'express';
import { jsonMapperController } from './json-mapper.controller';

const router = Router();

router.post('/map-to-ids', jsonMapperController.mapToIds);

export default router;
