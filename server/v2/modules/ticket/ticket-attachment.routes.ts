import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { ticketAttachmentController } from './ticket-attachment.controller';
import { isAuthenticated } from '../../middlewares/auth';
import { orgBranchScope } from '../../middlewares/org-branch-scope';

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const fileStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only images (JPEG, PNG, GIF, WebP) and PDF files are allowed'));
  }
};

const upload = multer({ storage: fileStorage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

router.use(isAuthenticated, orgBranchScope);

router.get('/ticket/:ticketId', ticketAttachmentController.listByTicketId);
router.post('/ticket/:ticketId', upload.single('file'), ticketAttachmentController.uploadAttachment);
router.get('/:id/download', ticketAttachmentController.downloadAttachment);
router.delete('/:id', ticketAttachmentController.deleteAttachment);

export default router;
