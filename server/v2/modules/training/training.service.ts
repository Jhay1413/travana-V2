import { trainingRepository, type ScopeOrTrusted } from './training.repository';
import { trainingLessonRepository } from './training-lesson.repository';
import { trainingSectionRepository } from './training-section.repository';
import { trainingQuizRepository } from './training-quiz.repository';
import { AppError } from '../../utils/error-handler';
import { normalizeTrainingUrl, TRAINING_THUMBNAIL_PREFIX } from './training-storage.util';
import { hasAnyRole, type Scope } from '../../utils/scope';
import type { InsertTrainingCourse, TrainingCourse, TrainingLessonAsset } from '@shared/schema';
import type { CreateCourseInput, UpdateCourseInput, CourseWithContent, LessonWithAssets } from './training.types';

/**
 * Row-level visibility check, mirroring `buildTrainingVisibilityConds`:
 * a trusted internal caller or `platform_admin` sees every course; every
 * other role only sees global courses (`org_id IS NULL`) or their own org's.
 * When `publishedOnly` is set, non-admins additionally require `status === 'published'`
 * — used by the learner-facing "get course" endpoint so drafts/archived courses
 * 404 for learners exactly like out-of-scope courses do.
 */
export function courseVisibleTo(course: TrainingCourse, scope: ScopeOrTrusted, opts: { publishedOnly?: boolean } = {}): boolean {
  if (scope.orgId === null) return true; // trusted internal caller
  const s = scope as Scope;
  if (s.orgRole === 'platform_admin') return true;

  if (opts.publishedOnly && course.status !== 'published') return false;
  return course.org_id === null || course.org_id === s.orgId;
}

function isPlatformScope(scope: ScopeOrTrusted): boolean {
  return scope.orgId === null || (scope as Scope).orgRole === 'platform_admin';
}

function hasOrgAdminRole(scope: ScopeOrTrusted): boolean {
  if (scope.orgId === null) return false;
  const s = scope as Scope;
  return s.orgRole === 'org_admin' || hasAnyRole(s.orgRoles, ['org_admin']);
}

/**
 * Role-level authoring check, for operations with no course row yet (create,
 * admin list, upload presign): a trusted internal caller, `platform_admin`
 * or `org_admin`.
 */
export function isCourseAuthorRole(scope: ScopeOrTrusted): boolean {
  return isPlatformScope(scope) || hasOrgAdminRole(scope);
}

/**
 * THE authoring rule, used by every course-content mutation and by the
 * draft / answer-key visibility decisions: a trusted internal caller or
 * `platform_admin` may author any course; an `org_admin` may author only
 * courses owned by their own organisation (never global courses, never
 * another org's). Every other role may not author.
 */
export function canAuthorCourse(course: TrainingCourse, scope: ScopeOrTrusted): boolean {
  if (isPlatformScope(scope)) return true;
  if (!hasOrgAdminRole(scope)) return false;
  const orgId = (scope as Scope).orgId;
  return Boolean(orgId) && course.org_id === orgId;
}

const FORBIDDEN_MESSAGE = 'You do not have permission to perform this action';
const OWN_ORG_ONLY_MESSAGE = 'Organisation admins can only create courses for their own organisation';

export const trainingService = {
  async createCourse(input: CreateCourseInput, scope: ScopeOrTrusted): Promise<TrainingCourse> {
    if (!isCourseAuthorRole(scope)) throw new AppError(FORBIDDEN_MESSAGE, 403);

    let visibility: 'global' | 'org';
    let orgId: string | null;

    if (isPlatformScope(scope)) {
      if (!input.visibility) throw new AppError('visibility is required', 400);
      visibility = input.visibility;
      if (visibility === 'org' && !input.orgId) {
        throw new AppError("orgId is required when visibility is 'org'", 400);
      }
      orgId = visibility === 'org' ? input.orgId ?? null : null;
    } else {
      // org_admin: always their own organisation, never global.
      const ownOrgId = (scope as Scope).orgId;
      if (!ownOrgId || input.visibility === 'global' || (input.orgId && input.orgId !== ownOrgId)) {
        throw new AppError(OWN_ORG_ONLY_MESSAGE, 403);
      }
      visibility = 'org';
      orgId = ownOrgId;
    }

    const data: InsertTrainingCourse = {
      title: input.title,
      category: input.category,
      description: input.description ?? null,
      thumbnail_url: input.thumbnailUrl
        ? normalizeTrainingUrl(input.thumbnailUrl, TRAINING_THUMBNAIL_PREFIX, 'thumbnailUrl')
        : null,
      visibility,
      org_id: orgId,
      passing_score: input.passingScore ?? 80,
      require_content_before_quiz: input.requireContentBeforeQuiz ?? true,
      created_by: (scope as Scope).userId ?? null,
      status: 'draft',
    };

    return trainingRepository.createCourse(data);
  },

  async updateCourse(id: string, rawInput: UpdateCourseInput, scope: ScopeOrTrusted): Promise<TrainingCourse> {
    const course = await this.getCourseForAuthoring(id, scope);
    if (course.status === 'archived') {
      throw new AppError('Cannot edit an archived course', 400);
    }

    let input = rawInput;
    if (!isPlatformScope(scope)) {
      // org_admin: the course must stay in their own organisation.
      if (rawInput.visibility === 'global' || (rawInput.orgId && rawInput.orgId !== (scope as Scope).orgId)) {
        throw new AppError('Organisation admins can only manage courses for their own organisation', 403);
      }
      // Ownership never changes for an org author; ignore any (null) orgId.
      input = { ...rawInput, orgId: undefined };
    }

    const patch: Partial<InsertTrainingCourse> = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.category !== undefined) patch.category = input.category;
    if (input.description !== undefined) patch.description = input.description ?? null;
    if (input.thumbnailUrl !== undefined) {
      patch.thumbnail_url = input.thumbnailUrl
        ? normalizeTrainingUrl(input.thumbnailUrl, TRAINING_THUMBNAIL_PREFIX, 'thumbnailUrl')
        : null;
    }
    if (input.passingScore !== undefined) patch.passing_score = input.passingScore;
    if (input.requireContentBeforeQuiz !== undefined) patch.require_content_before_quiz = input.requireContentBeforeQuiz;

    if (input.visibility !== undefined) {
      patch.visibility = input.visibility;
      if (input.visibility === 'global') {
        patch.org_id = null;
      } else {
        const orgId = input.orgId ?? course.org_id;
        if (!orgId) throw new AppError("orgId is required when visibility is 'org'", 400);
        patch.org_id = orgId;
      }
    } else if (input.orgId !== undefined && course.visibility === 'org') {
      patch.org_id = input.orgId;
    }

    const updated = await trainingRepository.updateCourse(id, patch);
    if (!updated) throw new AppError('Course not found', 404);
    return updated;
  },

  /**
   * Authoring-aware read, used by the course-content GET and the quiz GETs
   * (NOT by learner write flows — those use `getCourseForLearner`). Anyone who
   * `canAuthorCourse` that course may fetch it in any status (draft included,
   * for authoring); everyone else only sees it once published and in-scope —
   * otherwise this throws the same 404 an out-of-scope resource would,
   * matching the booking module's pattern. An `org_admin` therefore sees their
   * own org's drafts but a global course only once published, as a learner.
   */
  async getCourse(id: string, scope: ScopeOrTrusted): Promise<TrainingCourse> {
    const course = await trainingRepository.findCourseById(id);
    if (!course) throw new AppError('Course not found', 404);

    if (canAuthorCourse(course, scope)) return course;
    if (!courseVisibleTo(course, scope, { publishedOnly: true })) {
      throw new AppError('Course not found', 404);
    }
    return course;
  },

  /**
   * Strict learner read for enroll / progress / quiz attempts: in-scope AND
   * published for everyone except trusted / platform_admin (who bypass the
   * published check). Unlike `getCourse`, an org_admin gets no draft access
   * here, so learner flows behave identically for every role.
   */
  async getCourseForLearner(id: string, scope: ScopeOrTrusted): Promise<TrainingCourse> {
    const course = await trainingRepository.findCourseById(id);
    if (!course) throw new AppError('Course not found', 404);

    if (!courseVisibleTo(course, scope, { publishedOnly: !isPlatformScope(scope) })) {
      throw new AppError('Course not found', 404);
    }
    return course;
  },

  /**
   * Read path for every authoring mutation: the course must exist and the
   * caller must `canAuthorCourse` it, else 404 (404-as-permission, so an
   * org_admin cannot even probe global / foreign courses).
   */
  async getCourseForAuthoring(id: string, scope: ScopeOrTrusted): Promise<TrainingCourse> {
    const course = await trainingRepository.findCourseById(id);
    if (!course || !canAuthorCourse(course, scope)) throw new AppError('Course not found', 404);
    return course;
  },

  /**
   * Single cohesive course-read shape for `GET /training/courses/:id`: the
   * course row plus its ordered sections, each with its ordered lessons
   * (each with its ordered graphics assets, empty for video lessons) and
   * its own quiz flags. Visibility/publish gating is identical to
   * `getCourse` since it's the same read path, just enriched.
   */
  async getCourseWithContent(id: string, scope: ScopeOrTrusted): Promise<CourseWithContent> {
    const course = await this.getCourse(id, scope);
    const [sections, lessons, lessonQuizzes, sectionQuizzes] = await Promise.all([
      trainingSectionRepository.listSectionsByCourseId(id),
      trainingLessonRepository.listLessonsByCourseId(id),
      trainingQuizRepository.listLessonQuizzesByCourseId(id),
      trainingQuizRepository.listSectionQuizzesByCourseId(id),
    ]);
    const assets = await trainingLessonRepository.listAssetsByLessonIds(lessons.map((l) => l.id));
    const lessonIdsWithQuiz = new Set(lessonQuizzes.map((q) => q.lesson_id));
    const lessonIdsWithRequiredQuiz = new Set(lessonQuizzes.filter((q) => q.is_required).map((q) => q.lesson_id));
    const sectionIdsWithQuiz = new Set(sectionQuizzes.map((q) => q.section_id));
    const sectionIdsWithRequiredQuiz = new Set(sectionQuizzes.filter((q) => q.is_required).map((q) => q.section_id));

    const assetsByLesson = new Map<string, TrainingLessonAsset[]>();
    for (const asset of assets) {
      const list = assetsByLesson.get(asset.lesson_id) ?? [];
      list.push(asset);
      assetsByLesson.set(asset.lesson_id, list);
    }

    const lessonsBySection = new Map<string, LessonWithAssets[]>();
    for (const lesson of lessons) {
      const shaped: LessonWithAssets = {
        ...lesson,
        assets: lesson.type === 'graphics' ? assetsByLesson.get(lesson.id) ?? [] : [],
        has_quiz: lessonIdsWithQuiz.has(lesson.id),
        quiz_required: lessonIdsWithRequiredQuiz.has(lesson.id),
      };
      const list = lessonsBySection.get(lesson.section_id) ?? [];
      list.push(shaped);
      lessonsBySection.set(lesson.section_id, list);
    }

    return {
      ...course,
      sections: sections.map((section) => ({
        ...section,
        lessons: lessonsBySection.get(section.id) ?? [],
        has_quiz: sectionIdsWithQuiz.has(section.id),
        quiz_required: sectionIdsWithRequiredQuiz.has(section.id),
      })),
    };
  },

  /**
   * Authoring guard shared by section/lesson/asset/quiz mutation endpoints:
   * the parent course must exist and be authorable by the caller
   * (`getCourseForAuthoring`, 404-as-permission), and must not be archived.
   */
  async assertCourseEditable(courseId: string, scope: ScopeOrTrusted): Promise<TrainingCourse> {
    const course = await this.getCourseForAuthoring(courseId, scope);
    if (course.status === 'archived') {
      throw new AppError('Cannot edit an archived course', 400);
    }
    return course;
  },

  async publishCourse(id: string, scope: ScopeOrTrusted): Promise<TrainingCourse> {
    const course = await this.getCourseForAuthoring(id, scope);
    if (course.status === 'archived') {
      throw new AppError('Cannot publish an archived course', 400);
    }
    const updated = await trainingRepository.setCourseStatus(id, 'published');
    if (!updated) throw new AppError('Course not found', 404);
    return updated;
  },

  async archiveCourse(id: string, scope: ScopeOrTrusted): Promise<TrainingCourse> {
    const course = await this.getCourseForAuthoring(id, scope);
    if (course.status === 'archived') {
      throw new AppError('Course is already archived', 400);
    }
    const updated = await trainingRepository.setCourseStatus(id, 'archived');
    if (!updated) throw new AppError('Course not found', 404);
    return updated;
  },

  /**
   * Permanently delete a course. `getCourseForAuthoring` enforces the same
   * ownership gate as every other authoring op (404-as-permission), so a caller
   * can only delete a course they may author. The FK cascade on `course_id` removes the
   * course's lessons, assets, quiz, questions, choices, enrollments, progress,
   * attempts and certificates in one shot — this is irreversible.
   */
  async deleteCourse(id: string, scope: ScopeOrTrusted): Promise<void> {
    await this.getCourseForAuthoring(id, scope);
    await trainingRepository.deleteCourse(id);
  },

  /**
   * Admin list, any status. platform_admin / trusted: every course.
   * org_admin: only courses owned by their own org (global courses are not
   * theirs to manage). Other roles: 403.
   */
  async listCourses(scope: ScopeOrTrusted): Promise<TrainingCourse[]> {
    if (isPlatformScope(scope)) return trainingRepository.listCoursesForAdmin(scope);
    if (!hasOrgAdminRole(scope)) throw new AppError(FORBIDDEN_MESSAGE, 403);
    const orgId = (scope as Scope).orgId;
    if (!orgId) return [];
    return trainingRepository.listCoursesForOrg(orgId);
  },

  /** Learner: published courses only, visibility-scoped. */
  async listPublishedCourses(scope: ScopeOrTrusted): Promise<TrainingCourse[]> {
    return trainingRepository.listPublishedCoursesForLearner(scope);
  },
};
