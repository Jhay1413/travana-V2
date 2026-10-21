import { Router } from 'express';
import { quoteShareController } from './quote-share.controller';
import { validate } from '../../middlewares/validation.middleware';
import { markSentValidator } from './quote-share.validator';

const router = Router();

router.post('/:id/generate-token', quoteShareController.generateToken);
router.get('/client/:clientId/views', quoteShareController.getClientViews);
router.get('/:id/views', quoteShareController.getViews);
router.get('/:id/customer-actions', quoteShareController.getCustomerActions);
router.patch('/:id/sent', validate(markSentValidator), quoteShareController.updateSent);

export default router;
