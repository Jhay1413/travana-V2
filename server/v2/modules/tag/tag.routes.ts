import { Router } from 'express';
import { tagController } from './tag.controller';

const router = Router();

router.get('/', tagController.getAllTags);
router.get('/search', tagController.searchTags);

export default router;
