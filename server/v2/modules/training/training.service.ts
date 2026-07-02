import { trainingRepository, type ScopeOrTrusted } from './training.repository';
import { trainingLessonRepository } from './training-lesson.repository';
import { AppError } from '../../utils/error-handler';
import type { Scope } from '../../utils/scope';
import type { InsertTrainingCourse, TrainingCourse, TrainingLessonAsset } from '@shared/schema';
import type { CreateCourseInput, UpdateCourseInput, CourseWithContent } from './training.types';

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

/**
 * Shared "am I in an admin authoring context" check: a trusted internal
 * caller or `platform_admin` — used to decide draft/archived visibility and
 * whether quiz correctness (`is_correct`) may be exposed.
 */
export function isAdminContext(scope: ScopeOrTrusted): boolean {
  return scope.orgId === null || (scope as Scope).orgRole === 'platform_admin';
}

export const trainingService = {
  async createCourse(input: CreateCourseInput, scope: ScopeOrTrusted): Promise<TrainingCourse> {
    if (input.visibility === 'org' && !input.orgId) {
      throw new AppError("orgId is required when visibility is 'org'", 400);
    }

    const data: InsertTrainingCourse = {
      title: input.title,
      description: input.description ?? null,
      thumbnail_url: input.thumbnailUrl ?? null,
      visibility: input.visibility,
      org_id: input.visibility === 'org' ? input.orgId ?? null : null,
      passing_score: input.passingScore ?? 80,
      require_content_before_quiz: input.requireContentBeforeQuiz ?? true,
      created_by: (scope as Scope).userId ?? null,
      status: 'draft',
    };

    return trainingRepository.createCourse(data);
  },

  async updateCourse(id: string, input: UpdateCourseInput, scope: ScopeOrTrusted): Promise<TrainingCourse> {
    const course = await this.getCourse(id, scope);
    if (course.status === 'archived') {
      throw new AppError('Cannot edit an archived course', 400);
    }

    const patch: Partial<InsertTrainingCourse> = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description ?? null;
    if (input.thumbnailUrl !== undefined) patch.thumbnail_url = input.thumbnailUrl ?? null;
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
   * Shared read path for both the learner-facing GET and the admin
   * update/publish/archive flows. `platform_admin` may fetch any course by id
   * (draft included, for authoring); everyone else only sees it once
   * published and in-scope — otherwise this throws the same 404 an
   * out-of-scope resource would, matching the booking module's pattern.
   */
  async getCourse(id: string, scope: ScopeOrTrusted): Promise<TrainingCourse> {
    const course = await trainingRepository.findCourseById(id);
    if (!course) throw new AppError('Course not found', 404);

    if (!courseVisibleTo(course, scope, { publishedOnly: !isAdminContext(scope) })) {
      throw new AppError('Course not found', 404);
    }
    return course;
  },

  /**
   * Single cohesive course-read shape for `GET /training/courses/:id`: the
   * course row plus its ordered lessons, each with its ordered graphics
   * assets attached (empty for video lessons). Visibility/publish gating is
   * identical to `getCourse` since it's the same read path, just enriched.
   */
  async getCourseWithContent(id: string, scope: ScopeOrTrusted): Promise<CourseWithContent> {
    const course = await this.getCourse(id, scope);
    const lessons = await trainingLessonRepository.listLessonsByCourseId(id);
    const lessonIds = lessons.map((l) => l.id);
    const assets = await trainingLessonRepository.listAssetsByLessonIds(lessonIds);

    const assetsByLesson = new Map<string, TrainingLessonAsset[]>();
    for (const asset of assets) {
      const list = assetsByLesson.get(asset.lesson_id) ?? [];
      list.push(asset);
      assetsByLesson.set(asset.lesson_id, list);
    }

    return {
      ...course,
      lessons: lessons.map((lesson) => ({
        ...lesson,
        assets: lesson.type === 'graphics' ? assetsByLesson.get(lesson.id) ?? [] : [],
      })),
    };
  },

  /**
   * Authoring guard shared by lesson/asset mutation endpoints: the parent
   * course must exist and be visible to the caller (404-as-permission, same
   * as `getCourse`), and must not be archived.
   */
  async assertCourseEditable(courseId: string, scope: ScopeOrTrusted): Promise<TrainingCourse> {
    const course = await this.getCourse(courseId, scope);
    if (course.status === 'archived') {
      throw new AppError('Cannot edit an archived course', 400);
    }
    return course;
  },

  async publishCourse(id: string, scope: ScopeOrTrusted): Promise<TrainingCourse> {
    const course = await this.getCourse(id, scope);
    if (course.status === 'archived') {
      throw new AppError('Cannot publish an archived course', 400);
    }
    const updated = await trainingRepository.setCourseStatus(id, 'published');
    if (!updated) throw new AppError('Course not found', 404);
    return updated;
  },

  async archiveCourse(id: string, scope: ScopeOrTrusted): Promise<TrainingCourse> {
    const course = await this.getCourse(id, scope);
    if (course.status === 'archived') {
      throw new AppError('Course is already archived', 400);
    }
    const updated = await trainingRepository.setCourseStatus(id, 'archived');
    if (!updated) throw new AppError('Course not found', 404);
    return updated;
  },

  /** Admin: every course in scope, any status. */
  async listCourses(scope: ScopeOrTrusted): Promise<TrainingCourse[]> {
    return trainingRepository.listCoursesForAdmin(scope);
  },

  /** Learner: published courses only, visibility-scoped. */
  async listPublishedCourses(scope: ScopeOrTrusted): Promise<TrainingCourse[]> {
    return trainingRepository.listPublishedCoursesForLearner(scope);
  },
};
