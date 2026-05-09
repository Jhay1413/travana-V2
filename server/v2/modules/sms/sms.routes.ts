import { Router } from 'express';
import { smsController } from './sms.controller';

const router = Router();

router.get('/status', smsController.status);
router.get('/templates', smsController.listTemplates);
router.post('/templates', smsController.createTemplate);
router.put('/templates/:id', smsController.updateTemplate);
router.delete('/templates/:id', smsController.deleteTemplate);
router.post('/preview-recipients', smsController.previewRecipients);
router.post('/send', smsController.send);
router.get('/messages', smsController.listMessages);
router.put('/clients/:id/opt-in', smsController.setOptIn);

export default router;
