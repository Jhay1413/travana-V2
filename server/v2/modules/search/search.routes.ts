import { Router } from 'express';
import { searchController } from './search.controller';

const router = Router();

router.get('/', searchController.globalSearch);

export default router;
