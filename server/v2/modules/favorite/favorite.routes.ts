import { Router } from 'express';
import { favoriteController } from './favorite.controller';

const router = Router();

router.get('/', favoriteController.getAll);
router.post('/', favoriteController.add);
router.post('/toggle', favoriteController.toggle);
router.get('/check', favoriteController.check);
router.delete('/:id', favoriteController.remove);

export default router;
