import { Router } from 'express';
import { hubPostController } from './hub-post.controller';

const router = Router();

router.get('/', hubPostController.getAll);
router.post('/', hubPostController.create);
router.delete('/:id', hubPostController.remove);
router.post('/:id/like', hubPostController.like);
router.post('/:id/comment', hubPostController.comment);

export default router;
