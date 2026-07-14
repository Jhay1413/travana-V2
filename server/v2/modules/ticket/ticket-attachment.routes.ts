import { Router } from 'express';
import multer from 'multer';
import { ticketAttachmentController } from './ticket-attachment.controller';
import { isAuthenticated } from '../../middlewares/auth';
import { orgBranchScope } from '../../middlewares/org-branch-scope';

// In-memory upload — bytes go straight to S3 (see ticket-attachment.service.ts).
// No local-disk storage.
const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only images (JPEG, PNG, GIF, WebP) and PDF files are allowed'));
  }
};

const upload = multer({ storage: multer.memoryStorage(), fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

router.use(isAuthenticated, orgBranchScope);

router.get('/ticket/:ticketId', ticketAttachmentController.listByTicketId);
router.post('/ticket/:ticketId', upload.single('file'), ticketAttachmentController.uploadAttachment);
router.get('/:id/download', ticketAttachmentController.downloadAttachment);
router.delete('/:id', ticketAttachmentController.deleteAttachment);

export default router;
