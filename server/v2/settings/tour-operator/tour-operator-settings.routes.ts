import { Router } from 'express';
import multer from 'multer';
import { tourOperatorSettingsController } from './tour-operator-settings.controller';

const router = Router();
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed. Only JPEG, PNG, WebP and GIF are accepted.`));
    }
  },
});

router.get('/', tourOperatorSettingsController.findAll);
router.get('/:id', tourOperatorSettingsController.findById);
router.post('/', tourOperatorSettingsController.create);
router.patch('/:id', tourOperatorSettingsController.update);
router.delete('/:id', tourOperatorSettingsController.remove);
router.post('/:id/logo', upload.single('logo'), tourOperatorSettingsController.uploadLogo);
router.delete('/:id/logo', tourOperatorSettingsController.deleteLogo);

export default router;
