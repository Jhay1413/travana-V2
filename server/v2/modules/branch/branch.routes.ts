import { Router } from 'express';
import { branchController } from './branch.controller';
import { isAuthenticated } from '../../middlewares/auth';
import { orgBranchScope } from '../../middlewares/org-branch-scope';

const router = Router();

router.use(isAuthenticated, orgBranchScope);

router.get('/',      branchController.list);
router.get('/:id',   branchController.getById);
router.post('/',     branchController.create);
router.patch('/:id', branchController.update);
router.delete('/:id',branchController.remove);

export default router;
