import { Router } from 'express';
import { hubPostController } from './hub-post.controller';
import { requireOrgRole } from '../../middlewares/auth/require-org-role';

// Hub posts are global by design (one shared content library across all orgs).
// Reads are open to any authenticated user; writes are restricted to org_admin
// and platform_admin so a regular agent can't publish/delete shared content.
const router = Router();

router.get('/', hubPostController.getAll);

router.post('/', requireOrgRole(['org_admin', 'platform_admin']), hubPostController.create);
// Deletion is authorized inside the service (post author OR admin/manager), so the
// route stays open to authenticated users and the service enforces ownership.
router.delete('/:id', hubPostController.remove);

// Like / comment / hide are user-level interactions, kept open to all authenticated users.
router.post('/:id/like', hubPostController.like);
router.post('/:id/comment', hubPostController.comment);
router.post('/:id/hide', hubPostController.hide);

export default router;
