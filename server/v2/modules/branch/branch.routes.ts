import { Router } from 'express';
import { branchController } from './branch.controller';
import { isAuthenticated } from '../../middlewares/auth';
import { orgBranchScope } from '../../middlewares/org-branch-scope';
import { requireOrgRole } from '../../middlewares/auth/require-org-role';
import { validate } from '../../middlewares/validation.middleware';
import { createBranchSchema, updateBranchSchema } from './branch.validator';

const router = Router();

router.use(isAuthenticated, orgBranchScope);

const adminOnly = requireOrgRole(['org_admin', 'platform_admin']);

router.get('/',      branchController.list);
router.get('/:id',   branchController.getById);
router.post('/',     adminOnly, validate(createBranchSchema), branchController.create);
router.patch('/:id', adminOnly, validate(updateBranchSchema), branchController.update);
router.delete('/:id',adminOnly, branchController.remove);

export default router;
