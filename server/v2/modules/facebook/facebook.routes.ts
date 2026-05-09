import { Router } from 'express';
import { facebookController } from './facebook.controller';

const router = Router();

router.get('/auth', facebookController.auth);
router.get('/callback', facebookController.callback);
router.get('/webhook', facebookController.verifyWebhook);
router.post('/webhook', facebookController.receiveWebhook);
router.get('/pages', facebookController.getPages);
router.delete('/pages/:id', facebookController.disconnectPage);
router.get('/pages/:id/conversations', facebookController.getConversations);
router.get('/conversations/:conversationId/messages', facebookController.getMessages);
router.post('/pages/:id/send', facebookController.sendMessage);

export default router;
