import { Router } from 'express';
import { feedbackController } from './feedback.controller';

const router = Router();

router.get('/', feedbackController.getAll);
router.get('/mine', feedbackController.getMine);
router.post('/', feedbackController.create);
router.patch('/:id/status', feedbackController.updateStatus);
router.delete('/:id', feedbackController.remove);

export default router;
