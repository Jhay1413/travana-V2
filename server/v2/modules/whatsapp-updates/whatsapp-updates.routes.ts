import { Router } from 'express';
import { whatsappUpdatesController } from './whatsapp-updates.controller';
import { validate } from '../../middlewares/validation.middleware';
import { denyOrgRole, requireAnyOrgRole } from '../../middlewares/auth/require-org-role';
import {
  saveUpdateTemplateSettingsValidator,
  sendToClientValidator,
  sendToConversationValidator,
  windowValidator,
} from './whatsapp-updates.validator';

const router = Router();

// Template settings: managers only, never homeworkers (even one who also manages).
const managerOnly = [requireAnyOrgRole(['org_admin', 'branch_manager', 'platform_admin']), denyOrgRole(['homeworker'])];

router.get('/settings', ...managerOnly, whatsappUpdatesController.getSettings);
router.put('/settings', ...managerOnly, validate(saveUpdateTemplateSettingsValidator), whatsappUpdatesController.saveSettings);

// Open to every non-homeworker (the mount already denies homeworkers).
router.get('/template', whatsappUpdatesController.getTemplate);
router.get('/conversations/:conversationId/window', validate(windowValidator), whatsappUpdatesController.getWindow);
router.post('/conversations/:conversationId/send', validate(sendToConversationValidator), whatsappUpdatesController.sendToConversation);
router.post('/clients/:clientId/send', validate(sendToClientValidator), whatsappUpdatesController.sendToClient);

export default router;
