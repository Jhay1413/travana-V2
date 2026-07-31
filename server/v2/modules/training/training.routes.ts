import { Router } from 'express';
import multer from 'multer';
import { trainingController } from './training.controller';
import { trainingLessonController } from './training-lesson.controller';
import { trainingUploadController } from './training-upload.controller';
import { trainingProgressController } from './training-progress.controller';
import { trainingQuizController } from './training-quiz.controller';
import { validate } from '../../middlewares/validation.middleware';
import { requireOrgRole } from '../../middlewares/auth/require-org-role';
import { createCourseValidator, updateCourseValidator, courseIdValidator } from './training.validator';
import {
  createLessonValidator,
  updateLessonValidator,
  lessonIdValidator,
  reorderLessonsValidator,
  addAssetsValidator,
  assetIdValidator,
} from './training-lesson.validator';
import { presignUploadValidator } from './training-upload.validator';
import { enrollValidator, myStatusValidator, progressUpdateValidator } from './training-progress.validator';
import {
  upsertQuizValidator,
  quizCourseIdValidator,
  submitQuizAttemptValidator,
  upsertLessonQuizValidator,
  quizLessonIdValidator,
  submitLessonQuizAttemptValidator,
} from './training-quiz.validator';

const router = Router();

// Same multer setup as booking.routes.ts (memoryStorage, image allowlist,
// 5MB cap) — reused verbatim for graphics/slide uploads.
const ALLOWED_ASSET_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const uploadAsset = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_ASSET_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed. Only JPEG, PNG, WebP and GIF are accepted.`));
    }
  },
});

// Route layout note: both the admin course list (any status) and the learner
// course list (published only) conceptually live at "GET /courses". To avoid
// a collision, the learner list keeps the plain path and the admin list is
// disambiguated at GET /courses/admin — registered before the dynamic
// GET /courses/:id so it isn't swallowed by the `:id` param.

// Learner (all authenticated staff)
router.get('/courses', trainingController.listCourses);
router.get('/courses/admin', requireOrgRole(['platform_admin']), trainingController.listCoursesAdmin);
router.get('/courses/:id', validate(courseIdValidator), trainingController.getCourseById);

// The current user's enrollments (course id + status) for the "My Courses"
// filter. Distinct top-level path — never collides with `GET /courses/:id`.
router.get('/my-courses', trainingProgressController.getMyEnrollments);

router.post('/courses/:id/enroll', validate(enrollValidator), trainingProgressController.enroll);
router.get('/courses/:id/my-status', validate(myStatusValidator), trainingProgressController.getMyStatus);
router.patch('/lessons/:id/progress', validate(progressUpdateValidator), trainingProgressController.updateProgress);

// Quiz — GET is role-aware (admin sees is_correct, learners never do; see
// training-quiz.service.ts). Submitting an attempt is learner-facing;
// grading is server-side only. Both are distinct 3-segment paths so they
// never collide with the 2-segment `GET /courses/:id` above.
router.get('/courses/:id/quiz', validate(quizCourseIdValidator), trainingQuizController.getQuiz);
router.post('/courses/:id/quiz/attempts', validate(submitQuizAttemptValidator), trainingQuizController.submitAttempt);

// Per-lesson quizzes — same role-aware GET / learner-attempt pattern as the
// course final quiz above, keyed by lesson id. Distinct 3-segment paths, so
// they never collide with `PATCH/DELETE /lessons/:id`.
router.get('/lessons/:id/quiz', validate(quizLessonIdValidator), trainingQuizController.getLessonQuiz);
router.post('/lessons/:id/quiz/attempts', validate(submitLessonQuizAttemptValidator), trainingQuizController.submitLessonAttempt);

// Authoring (platform_admin only)
router.post('/courses', requireOrgRole(['platform_admin']), validate(createCourseValidator), trainingController.createCourse);
router.patch('/courses/:id', requireOrgRole(['platform_admin']), validate(updateCourseValidator), trainingController.updateCourse);
router.post('/courses/:id/publish', requireOrgRole(['platform_admin']), validate(courseIdValidator), trainingController.publishCourse);
router.post('/courses/:id/archive', requireOrgRole(['platform_admin']), validate(courseIdValidator), trainingController.archiveCourse);
router.delete('/courses/:id', requireOrgRole(['platform_admin']), validate(courseIdValidator), trainingController.deleteCourse);
router.put('/courses/:id/quiz', requireOrgRole(['platform_admin']), validate(upsertQuizValidator), trainingQuizController.upsertQuiz);
router.put('/lessons/:id/quiz', requireOrgRole(['platform_admin']), validate(upsertLessonQuizValidator), trainingQuizController.upsertLessonQuiz);

// Video: presigned direct-to-S3 PUT — server never buffers the file (see
// training-upload.service.ts).
router.post(
  '/uploads/presign',
  requireOrgRole(['platform_admin']),
  validate(presignUploadValidator),
  trainingUploadController.presign,
);

// Lessons
router.post(
  '/courses/:id/lessons',
  requireOrgRole(['platform_admin']),
  validate(createLessonValidator),
  trainingLessonController.createLesson,
);
router.patch(
  '/courses/:id/lessons/reorder',
  requireOrgRole(['platform_admin']),
  validate(reorderLessonsValidator),
  trainingLessonController.reorderLessons,
);
router.patch(
  '/lessons/:id',
  requireOrgRole(['platform_admin']),
  validate(updateLessonValidator),
  trainingLessonController.updateLesson,
);
router.delete(
  '/lessons/:id',
  requireOrgRole(['platform_admin']),
  validate(lessonIdValidator),
  trainingLessonController.deleteLesson,
);

// Lesson assets (graphics) — multer upload (small images, straight to S3)
// and a URL-list variant that complements it.
router.post(
  '/lessons/:id/assets/upload',
  requireOrgRole(['platform_admin']),
  uploadAsset.array('files', 20),
  trainingLessonController.uploadAssets,
);
router.post(
  '/lessons/:id/assets',
  requireOrgRole(['platform_admin']),
  validate(addAssetsValidator),
  trainingLessonController.addAssets,
);
router.delete(
  '/assets/:id',
  requireOrgRole(['platform_admin']),
  validate(assetIdValidator),
  trainingLessonController.deleteAsset,
);

export default router;
