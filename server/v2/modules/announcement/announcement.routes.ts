import { Router } from 'express';
import { announcementController, imageUpload } from './announcement.controller';

const router = Router();

router.get('/', announcementController.getAll);
router.post('/', announcementController.create);
router.post('/upload-image', imageUpload.single('image'), announcementController.uploadImage);
router.get('/mentionable-users', announcementController.getMentionableUsers);
router.get('/likes/bulk', announcementController.getBulkLikes);
router.patch('/:id', announcementController.update);
router.patch('/:id/pin', announcementController.togglePin);
router.delete('/:id', announcementController.remove);
router.post('/:id/like', announcementController.like);
router.get('/:id/likes', announcementController.getLikes);
router.post('/:id/share', announcementController.share);

export default router;
