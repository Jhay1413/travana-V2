import { Router } from 'express';
import { hubPostController } from './hub-post.controller';
import { requireOrgRole } from '../../middlewares/auth/require-org-role';

// Hub posts are global by design (one shared content library across all orgs).
// Reads are open to any authenticated user; writes are restricted to org_admin
// and platform_admin so a regular agent can't publish/delete shared content.
const router = Router();

router.get('/', hubPostController.getAll);

router.post('/', requireOrgRole(['org_admin', 'platform_admin']), hubPostController.create);
router.delete('/:id', requireOrgRole(['org_admin', 'platform_admin']), hubPostController.remove);

// Like / comment are user-level interactions, kept open to all authenticated users.
router.post('/:id/like', hubPostController.like);
router.post('/:id/comment', hubPostController.comment);

export default router;
