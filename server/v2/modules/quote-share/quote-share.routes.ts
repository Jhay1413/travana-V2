import { Router } from 'express';
import { quoteShareController } from './quote-share.controller';
import { validate } from '../../middlewares/validation.middleware';
import { denyOrgRole, requireAnyOrgRole } from '../../middlewares/auth/require-org-role';
import { sendSevenContext } from '../conversation-integration/conversation-integration.middleware';
import { markSentValidator, saveWhatsappTemplateSettingsValidator, sendWhatsappValidator } from './quote-share.validator';

const router = Router();

// Template settings: managers only, never homeworkers (even one who also manages).
const templateManagerOnly = [requireAnyOrgRole(['org_admin', 'branch_manager', 'platform_admin']), denyOrgRole(['homeworker'])];

// Declared before any /:id routes.
router.get('/whatsapp-template-settings', ...templateManagerOnly, quoteShareController.getWhatsappTemplateSettings);
router.put('/whatsapp-template-settings', ...templateManagerOnly, validate(saveWhatsappTemplateSettingsValidator), quoteShareController.saveWhatsappTemplateSettings);

router.post('/:id/generate-token', quoteShareController.generateToken);
// Runs inside the org's SendSeven tenant context. Mounted for homeworkers too:
// the service answers them with a `not_allowed` fallback without calling SendSeven.
router.post('/:id/send-whatsapp', validate(sendWhatsappValidator), sendSevenContext, quoteShareController.sendWhatsapp);
router.get('/client/:clientId/views', quoteShareController.getClientViews);
router.get('/:id/views', quoteShareController.getViews);
router.get('/:id/customer-actions', quoteShareController.getCustomerActions);
router.patch('/:id/sent', validate(markSentValidator), quoteShareController.updateSent);

export default router;
