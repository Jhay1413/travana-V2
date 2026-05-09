import { Router } from 'express';
import { destinationGuruController } from './destination-guru.controller';

const router = Router();

router.get('/', destinationGuruController.getAll);
router.get('/search/:destination', destinationGuruController.getByDestination);
router.post('/generate', destinationGuruController.generate);
router.get('/:id', destinationGuruController.getById);
router.delete('/:id', destinationGuruController.remove);

export default router;
