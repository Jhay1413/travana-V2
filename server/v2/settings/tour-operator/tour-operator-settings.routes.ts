import { Router } from 'express';
import multer from 'multer';
import { requirePlatformAdmin } from '../../middlewares/auth/require-platform-admin';
import { validate } from '../../middlewares/validation.middleware';
import { tourOperatorSettingsController } from './tour-operator-settings.controller';
import { createValidator, idValidator, listValidator, updateValidator } from './tour-operator-settings.validator';

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

// The catalogue is shared by every agency: only platform admins may change it.
router.use(requirePlatformAdmin);

router.get('/', validate(listValidator), tourOperatorSettingsController.findAll);
router.get('/:id', validate(idValidator), tourOperatorSettingsController.findById);
router.post('/', validate(createValidator), tourOperatorSettingsController.create);
router.patch('/:id', validate(updateValidator), tourOperatorSettingsController.update);
router.delete('/:id', validate(idValidator), tourOperatorSettingsController.remove);
router.post('/:id/logo', validate(idValidator), upload.single('logo'), tourOperatorSettingsController.uploadLogo);
router.delete('/:id/logo', validate(idValidator), tourOperatorSettingsController.deleteLogo);

export default router;
