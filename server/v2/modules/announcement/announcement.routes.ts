import { Router } from 'express';
import { announcementController, imageUpload } from './announcement.controller';
import { requireOrgRole } from '../../middlewares/auth/require-org-role';

// Announcements are global by design (broadcasts visible to every org).
// Reads + interactions stay open; create/edit/pin/delete and image upload
// are restricted to org_admin and platform_admin.
const router = Router();

router.get('/', announcementController.getAll);
router.get('/mentionable-users', announcementController.getMentionableUsers);
router.get('/likes/bulk', announcementController.getBulkLikes);
router.get('/:id/likes', announcementController.getLikes);

router.post('/', requireOrgRole(['org_admin', 'platform_admin']), announcementController.create);
router.post('/upload-image', requireOrgRole(['org_admin', 'platform_admin']), imageUpload.single('image'), announcementController.uploadImage);
router.patch('/:id', requireOrgRole(['org_admin', 'platform_admin']), announcementController.update);
router.patch('/:id/pin', requireOrgRole(['org_admin', 'platform_admin']), announcementController.togglePin);
router.delete('/:id', requireOrgRole(['org_admin', 'platform_admin']), announcementController.remove);

// Like + share are user-level interactions, kept open to all authenticated users.
router.post('/:id/like', announcementController.like);
router.post('/:id/share', announcementController.share);

export default router;
