import { Router } from 'express';
import { aiAskController } from './ai-ask.controller';

const router = Router();

router.post('/ask', aiAskController.ask);
router.post('/ask/save', aiAskController.saveToClient);

export default router;
