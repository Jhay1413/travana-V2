import { Router } from 'express';
import { quoteShareController } from './quote-share.controller';

const router = Router();

router.post('/:id/generate-token', quoteShareController.generateToken);
router.get('/:id/views', quoteShareController.getViews);
router.get('/:id/customer-actions', quoteShareController.getCustomerActions);
router.patch('/:id/sent', quoteShareController.updateSent);

export default router;
