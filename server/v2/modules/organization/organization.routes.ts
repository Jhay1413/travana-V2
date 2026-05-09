import { Router } from 'express';
import { organizationController } from './organization.controller';
import { isAuthenticated } from '../../middlewares/auth';

const router = Router();

router.get('/',     isAuthenticated, organizationController.list);
router.get('/:id',  isAuthenticated, organizationController.getById);
router.post('/',    isAuthenticated, organizationController.create);
router.patch('/:id',isAuthenticated, organizationController.update);
router.delete('/:id',isAuthenticated,organizationController.remove);

export default router;
