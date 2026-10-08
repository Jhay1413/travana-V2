import { Router } from 'express';
import multer from 'multer';
import { trainingController } from './training.controller';
import { trainingSectionController } from './training-section.controller';
import { trainingLessonController } from './training-lesson.controller';
import { trainingUploadController } from './training-upload.controller';
import { trainingProgressController } from './training-progress.controller';
import { trainingQuizController } from './training-quiz.controller';
import type { OrgRole } from '../../utils/scope';
import { validate } from '../../middlewares/validation.middleware';
import { requireOrgRole } from '../../middlewares/auth/require-org-role';
import { createCourseValidator, updateCourseValidator, courseIdValidator } from './training.validator';
import {
  createSectionValidator,
  updateSectionValidator,
  sectionIdValidator,
  reorderSectionsValidator,
} from './training-section.validator';
import {
  createLessonValidator,
  updateLessonValidator,
  lessonIdValidator,
  reorderLessonsValidator,
  reorderAssetsValidator,
  addAssetsValidator,
  assetIdValidator,
  updateAssetValidator,
  uploadAssetsValidator,
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
  upsertSectionQuizValidator,
  quizSectionIdValidator,
  submitSectionQuizAttemptValidator,
} from './training-quiz.validator';

const router = Router();

// Roles admitted to authoring routes. Coarse gate only; ownership is enforced
// in training.service.ts (canAuthorCourse / getCourseForAuthoring).
// NOTE: requireOrgRole checks the PRIMARY role (req.orgRole). This is safe for
// org_admin because ROLE_RANK (user-org-roles.service.ts) ranks org_admin above
// every other role, so a multi-role user holding org_admin always has it as
// primary. If that ranking ever changes, revisit this guard.
const authorRoles: OrgRole[] = ['platform_admin', 'org_admin'];

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
router.get('/courses/admin', requireOrgRole(authorRoles), trainingController.listCoursesAdmin);
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

// Per-section quizzes — same role-aware GET / learner-attempt pattern, keyed
// by section id. Distinct 3-segment paths under /sections, so they never
// collide with `PATCH/DELETE /sections/:id`.
router.get('/sections/:id/quiz', validate(quizSectionIdValidator), trainingQuizController.getSectionQuiz);
router.post('/sections/:id/quiz/attempts', validate(submitSectionQuizAttemptValidator), trainingQuizController.submitSectionAttempt);

// Authoring (platform_admin: any course; org_admin: own-org courses only -
// per-course ownership is enforced in the service layer via canAuthorCourse)
router.post('/courses', requireOrgRole(authorRoles), validate(createCourseValidator), trainingController.createCourse);
router.patch('/courses/:id', requireOrgRole(authorRoles), validate(updateCourseValidator), trainingController.updateCourse);
router.post('/courses/:id/publish', requireOrgRole(authorRoles), validate(courseIdValidator), trainingController.publishCourse);
router.post('/courses/:id/archive', requireOrgRole(authorRoles), validate(courseIdValidator), trainingController.archiveCourse);
router.delete('/courses/:id', requireOrgRole(authorRoles), validate(courseIdValidator), trainingController.deleteCourse);
router.put('/courses/:id/quiz', requireOrgRole(authorRoles), validate(upsertQuizValidator), trainingQuizController.upsertQuiz);
router.put('/lessons/:id/quiz', requireOrgRole(authorRoles), validate(upsertLessonQuizValidator), trainingQuizController.upsertLessonQuiz);
router.put('/sections/:id/quiz', requireOrgRole(authorRoles), validate(upsertSectionQuizValidator), trainingQuizController.upsertSectionQuiz);

// Sections (course → sections → lessons)
router.post(
  '/courses/:id/sections',
  requireOrgRole(authorRoles),
  validate(createSectionValidator),
  trainingSectionController.createSection,
);
router.patch(
  '/courses/:id/sections/reorder',
  requireOrgRole(authorRoles),
  validate(reorderSectionsValidator),
  trainingSectionController.reorderSections,
);
router.patch(
  '/sections/:id',
  requireOrgRole(authorRoles),
  validate(updateSectionValidator),
  trainingSectionController.updateSection,
);
router.delete(
  '/sections/:id',
  requireOrgRole(authorRoles),
  validate(sectionIdValidator),
  trainingSectionController.deleteSection,
);

// Video: presigned direct-to-S3 PUT — server never buffers the file (see
// training-upload.service.ts).
router.post(
  '/uploads/presign',
  requireOrgRole(authorRoles),
  validate(presignUploadValidator),
  trainingUploadController.presign,
);

// Lessons — created and reordered within their SECTION.
router.post(
  '/sections/:id/lessons',
  requireOrgRole(authorRoles),
  validate(createLessonValidator),
  trainingLessonController.createLesson,
);
router.patch(
  '/sections/:id/lessons/reorder',
  requireOrgRole(authorRoles),
  validate(reorderLessonsValidator),
  trainingLessonController.reorderLessons,
);
router.patch(
  '/lessons/:id',
  requireOrgRole(authorRoles),
  validate(updateLessonValidator),
  trainingLessonController.updateLesson,
);
router.delete(
  '/lessons/:id',
  requireOrgRole(authorRoles),
  validate(lessonIdValidator),
  trainingLessonController.deleteLesson,
);

// Lesson assets (graphics) — multer upload (small images, straight to S3)
// and a URL-list variant that complements it.
router.post(
  '/lessons/:id/assets/upload',
  requireOrgRole(authorRoles),
  uploadAsset.array('files', 20),
  validate(uploadAssetsValidator),
  trainingLessonController.uploadAssets,
);
router.post(
  '/lessons/:id/assets',
  requireOrgRole(authorRoles),
  validate(addAssetsValidator),
  trainingLessonController.addAssets,
);
router.patch(
  '/lessons/:id/assets/reorder',
  requireOrgRole(authorRoles),
  validate(reorderAssetsValidator),
  trainingLessonController.reorderAssets,
);
router.patch(
  '/assets/:id',
  requireOrgRole(authorRoles),
  validate(updateAssetValidator),
  trainingLessonController.updateAsset,
);
router.delete(
  '/assets/:id',
  requireOrgRole(authorRoles),
  validate(assetIdValidator),
  trainingLessonController.deleteAsset,
);

export default router;
