import { Router } from 'express';
import { userOrgRolesController } from './user-org-roles.controller';

// All routes here run after the global isAuthenticated + orgBranchScope mount.
const router = Router();

router.get(   '/me',       userOrgRolesController.listMyRoles);
router.post(  '/me/sell',  userOrgRolesController.startSelling);
router.delete('/me/sell',  userOrgRolesController.stopSelling);

export default router;
