import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./training.repository', () => ({
  trainingRepository: {
    createCourse: vi.fn(),
    updateCourse: vi.fn(),
    findCourseById: vi.fn(),
    setCourseStatus: vi.fn(),
    deleteCourse: vi.fn(),
    listCoursesForAdmin: vi.fn(),
    listCoursesForOrg: vi.fn(),
    listPublishedCoursesForLearner: vi.fn(),
  },
}));
vi.mock('./training-lesson.repository', () => ({ trainingLessonRepository: { findLessonById: vi.fn() } }));
vi.mock('./training-section.repository', () => ({ trainingSectionRepository: {} }));
vi.mock('./training-quiz.repository', () => ({
  trainingQuizRepository: { findQuizWithQuestions: vi.fn() },
}));
vi.mock('./training-progress.repository', () => ({ trainingProgressRepository: {} }));
vi.mock('./training-progress.service', () => ({
  getContentComplete: vi.fn(),
  assertLessonUnlocked: vi.fn(),
  assertSectionQuizUnlocked: vi.fn(),
}));
vi.mock('./training-section.service', () => ({ getSectionOrThrow: vi.fn() }));

import { trainingRepository } from './training.repository';
import { trainingQuizRepository } from './training-quiz.repository';
import { trainingService, canAuthorCourse, isCourseAuthorRole } from './training.service';
import { trainingQuizService } from './training-quiz.service';
import type { Scope, OrgRole } from '../../utils/scope';
import type { TrainingCourse } from '@shared/schema';

const repo = vi.mocked(trainingRepository);
const quizRepo = vi.mocked(trainingQuizRepository);

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const COURSE_ID = '33333333-3333-4333-8333-333333333333';

function scopeOf(orgRole: OrgRole, orgId: string = ORG_A, orgRoles: OrgRole[] = [orgRole]): Scope {
  return { orgId, branchId: null, orgRole, orgRoles, userId: 'user-1' };
}

const TRUSTED = { orgId: null } as const;
const PLATFORM = scopeOf('platform_admin', '');
const ORG_ADMIN = scopeOf('org_admin');
const AGENT = scopeOf('agent');

function course(over: Partial<TrainingCourse> = {}): TrainingCourse {
  return {
    id: COURSE_ID,
    title: 'T',
    category: 'Sales',
    description: null,
    thumbnail_url: null,
    visibility: 'org',
    org_id: ORG_A,
    status: 'published',
    passing_score: 80,
    require_content_before_quiz: true,
    created_by: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...over,
  } as TrainingCourse;
}

const OWN_PUBLISHED = course();
const OWN_DRAFT = course({ status: 'draft' });
const GLOBAL_PUBLISHED = course({ visibility: 'global', org_id: null });
const GLOBAL_DRAFT = course({ visibility: 'global', org_id: null, status: 'draft' });
const FOREIGN = course({ org_id: ORG_B });

beforeEach(() => {
  vi.resetAllMocks();
});

describe('canAuthorCourse', () => {
  it('trusted caller can author anything', () => {
    expect(canAuthorCourse(GLOBAL_PUBLISHED, TRUSTED)).toBe(true);
    expect(canAuthorCourse(FOREIGN, TRUSTED)).toBe(true);
  });
  it('platform_admin can author global and any org course', () => {
    expect(canAuthorCourse(GLOBAL_PUBLISHED, PLATFORM)).toBe(true);
    expect(canAuthorCourse(FOREIGN, PLATFORM)).toBe(true);
  });
  it('org_admin can author own-org course only', () => {
    expect(canAuthorCourse(OWN_PUBLISHED, ORG_ADMIN)).toBe(true);
    expect(canAuthorCourse(FOREIGN, ORG_ADMIN)).toBe(false);
    expect(canAuthorCourse(GLOBAL_PUBLISHED, ORG_ADMIN)).toBe(false);
  });
  it('org_admin held as a non-primary role (orgRoles union) still counts', () => {
    expect(canAuthorCourse(OWN_PUBLISHED, scopeOf('agent', ORG_A, ['agent', 'org_admin']))).toBe(true);
  });
  it('agent cannot author even own-org', () => {
    expect(canAuthorCourse(OWN_PUBLISHED, AGENT)).toBe(false);
  });
  it('org_admin with empty orgId cannot author (even a null-org row)', () => {
    const noOrg = scopeOf('org_admin', '');
    expect(canAuthorCourse(GLOBAL_PUBLISHED, noOrg)).toBe(false);
    expect(canAuthorCourse(OWN_PUBLISHED, noOrg)).toBe(false);
  });
  it('isCourseAuthorRole admits trusted, platform_admin, org_admin only', () => {
    expect(isCourseAuthorRole(TRUSTED)).toBe(true);
    expect(isCourseAuthorRole(PLATFORM)).toBe(true);
    expect(isCourseAuthorRole(ORG_ADMIN)).toBe(true);
    expect(isCourseAuthorRole(AGENT)).toBe(false);
  });
});

describe('getCourse', () => {
  it('org_admin sees own-org draft', async () => {
    repo.findCourseById.mockResolvedValue(OWN_DRAFT);
    await expect(trainingService.getCourse(COURSE_ID, ORG_ADMIN)).resolves.toBe(OWN_DRAFT);
  });
  it('org_admin gets 404 for a global draft', async () => {
    repo.findCourseById.mockResolvedValue(GLOBAL_DRAFT);
    await expect(trainingService.getCourse(COURSE_ID, ORG_ADMIN)).rejects.toMatchObject({ statusCode: 404 });
  });
  it('org_admin sees a global published course as a learner', async () => {
    repo.findCourseById.mockResolvedValue(GLOBAL_PUBLISHED);
    await expect(trainingService.getCourse(COURSE_ID, ORG_ADMIN)).resolves.toBe(GLOBAL_PUBLISHED);
  });
  it('agent gets 404 for an own-org draft', async () => {
    repo.findCourseById.mockResolvedValue(OWN_DRAFT);
    await expect(trainingService.getCourse(COURSE_ID, AGENT)).rejects.toMatchObject({ statusCode: 404 });
  });
  it('platform_admin sees any draft', async () => {
    repo.findCourseById.mockResolvedValue(GLOBAL_DRAFT);
    await expect(trainingService.getCourse(COURSE_ID, PLATFORM)).resolves.toBe(GLOBAL_DRAFT);
  });
});

describe('authoring mutations enforce ownership', () => {
  it('org_admin on a global published course: 404 and no mutation', async () => {
    repo.findCourseById.mockResolvedValue(GLOBAL_PUBLISHED);
    await expect(trainingService.assertCourseEditable(COURSE_ID, ORG_ADMIN)).rejects.toMatchObject({ statusCode: 404 });
    await expect(trainingService.updateCourse(COURSE_ID, { title: 'x' }, ORG_ADMIN)).rejects.toMatchObject({ statusCode: 404 });
    await expect(trainingService.publishCourse(COURSE_ID, ORG_ADMIN)).rejects.toMatchObject({ statusCode: 404 });
    await expect(trainingService.archiveCourse(COURSE_ID, ORG_ADMIN)).rejects.toMatchObject({ statusCode: 404 });
    await expect(trainingService.deleteCourse(COURSE_ID, ORG_ADMIN)).rejects.toMatchObject({ statusCode: 404 });
    expect(repo.updateCourse).not.toHaveBeenCalled();
    expect(repo.setCourseStatus).not.toHaveBeenCalled();
    expect(repo.deleteCourse).not.toHaveBeenCalled();
  });

  it('org_admin on a foreign-org course: 404', async () => {
    repo.findCourseById.mockResolvedValue(FOREIGN);
    await expect(trainingService.assertCourseEditable(COURSE_ID, ORG_ADMIN)).rejects.toMatchObject({ statusCode: 404 });
    await expect(trainingService.deleteCourse(COURSE_ID, ORG_ADMIN)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('agent on an own-org course: 404', async () => {
    repo.findCourseById.mockResolvedValue(OWN_PUBLISHED);
    await expect(trainingService.assertCourseEditable(COURSE_ID, AGENT)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('org_admin on own-org course: allowed', async () => {
    repo.findCourseById.mockResolvedValue(OWN_PUBLISHED);
    repo.updateCourse.mockResolvedValue(OWN_PUBLISHED);
    repo.setCourseStatus.mockResolvedValue(OWN_PUBLISHED);
    await expect(trainingService.assertCourseEditable(COURSE_ID, ORG_ADMIN)).resolves.toBe(OWN_PUBLISHED);
    await expect(trainingService.updateCourse(COURSE_ID, { title: 'x' }, ORG_ADMIN)).resolves.toBe(OWN_PUBLISHED);
    await expect(trainingService.publishCourse(COURSE_ID, ORG_ADMIN)).resolves.toBe(OWN_PUBLISHED);
    await expect(trainingService.archiveCourse(COURSE_ID, ORG_ADMIN)).resolves.toBe(OWN_PUBLISHED);
    await trainingService.deleteCourse(COURSE_ID, ORG_ADMIN);
    expect(repo.deleteCourse).toHaveBeenCalledWith(COURSE_ID);
  });

  it('platform_admin can edit a global course', async () => {
    repo.findCourseById.mockResolvedValue(GLOBAL_PUBLISHED);
    await expect(trainingService.assertCourseEditable(COURSE_ID, PLATFORM)).resolves.toBe(GLOBAL_PUBLISHED);
  });
});

describe('createCourse', () => {
  const base = { title: 'T', category: 'Sales' };

  it('org_admin: forced to org + own orgId when omitted', async () => {
    repo.createCourse.mockResolvedValue(OWN_DRAFT);
    await trainingService.createCourse(base, ORG_ADMIN);
    expect(repo.createCourse).toHaveBeenCalledWith(expect.objectContaining({ visibility: 'org', org_id: ORG_A, status: 'draft' }));
  });
  it('org_admin: explicit own org is fine', async () => {
    repo.createCourse.mockResolvedValue(OWN_DRAFT);
    await trainingService.createCourse({ ...base, visibility: 'org', orgId: ORG_A }, ORG_ADMIN);
    expect(repo.createCourse).toHaveBeenCalledWith(expect.objectContaining({ visibility: 'org', org_id: ORG_A }));
  });
  it('org_admin: 403 for global', async () => {
    await expect(trainingService.createCourse({ ...base, visibility: 'global' }, ORG_ADMIN)).rejects.toMatchObject({ statusCode: 403 });
    expect(repo.createCourse).not.toHaveBeenCalled();
  });
  it('org_admin: 403 for a foreign orgId', async () => {
    await expect(
      trainingService.createCourse({ ...base, visibility: 'org', orgId: ORG_B }, ORG_ADMIN),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(repo.createCourse).not.toHaveBeenCalled();
  });
  it('org_admin with no orgId: 403', async () => {
    await expect(trainingService.createCourse(base, scopeOf('org_admin', ''))).rejects.toMatchObject({ statusCode: 403 });
  });
  it('agent: 403', async () => {
    await expect(trainingService.createCourse(base, AGENT)).rejects.toMatchObject({ statusCode: 403 });
  });
  it('platform_admin can create a global course (org_id null)', async () => {
    repo.createCourse.mockResolvedValue(GLOBAL_DRAFT);
    await trainingService.createCourse({ ...base, visibility: 'global', orgId: ORG_B }, PLATFORM);
    expect(repo.createCourse).toHaveBeenCalledWith(expect.objectContaining({ visibility: 'global', org_id: null }));
  });
  it('platform_admin can create for any org; visibility is required', async () => {
    repo.createCourse.mockResolvedValue(FOREIGN);
    await trainingService.createCourse({ ...base, visibility: 'org', orgId: ORG_B }, PLATFORM);
    expect(repo.createCourse).toHaveBeenCalledWith(expect.objectContaining({ visibility: 'org', org_id: ORG_B }));
    await expect(trainingService.createCourse(base, PLATFORM)).rejects.toMatchObject({ statusCode: 400 });
    await expect(trainingService.createCourse({ ...base, visibility: 'org' }, PLATFORM)).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('updateCourse as org_admin', () => {
  beforeEach(() => {
    repo.findCourseById.mockResolvedValue(OWN_DRAFT);
    repo.updateCourse.mockResolvedValue(OWN_DRAFT);
  });
  it('403 when switching to global', async () => {
    await expect(trainingService.updateCourse(COURSE_ID, { visibility: 'global' }, ORG_ADMIN)).rejects.toMatchObject({ statusCode: 403 });
    expect(repo.updateCourse).not.toHaveBeenCalled();
  });
  it('403 when moving to a foreign org', async () => {
    await expect(trainingService.updateCourse(COURSE_ID, { orgId: ORG_B }, ORG_ADMIN)).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      trainingService.updateCourse(COURSE_ID, { visibility: 'org', orgId: ORG_B }, ORG_ADMIN),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(repo.updateCourse).not.toHaveBeenCalled();
  });
  it('a null orgId cannot null out the owning org', async () => {
    await trainingService.updateCourse(COURSE_ID, { orgId: null }, ORG_ADMIN);
    expect(repo.updateCourse.mock.calls[0][1]).not.toHaveProperty('org_id');
  });
  it('platform_admin can switch a course to global', async () => {
    await trainingService.updateCourse(COURSE_ID, { visibility: 'global' }, PLATFORM);
    expect(repo.updateCourse).toHaveBeenCalledWith(COURSE_ID, expect.objectContaining({ visibility: 'global', org_id: null }));
  });
});

describe('listCourses', () => {
  it('org_admin uses the org-only repository path', async () => {
    repo.listCoursesForOrg.mockResolvedValue([OWN_DRAFT]);
    await expect(trainingService.listCourses(ORG_ADMIN)).resolves.toEqual([OWN_DRAFT]);
    expect(repo.listCoursesForOrg).toHaveBeenCalledWith(ORG_A);
    expect(repo.listCoursesForAdmin).not.toHaveBeenCalled();
  });
  it('org_admin with empty orgId gets []', async () => {
    await expect(trainingService.listCourses(scopeOf('org_admin', ''))).resolves.toEqual([]);
    expect(repo.listCoursesForOrg).not.toHaveBeenCalled();
  });
  it('platform_admin uses the all path', async () => {
    repo.listCoursesForAdmin.mockResolvedValue([GLOBAL_DRAFT]);
    await trainingService.listCourses(PLATFORM);
    expect(repo.listCoursesForAdmin).toHaveBeenCalledWith(PLATFORM);
    expect(repo.listCoursesForOrg).not.toHaveBeenCalled();
  });
  it('agent: 403', async () => {
    await expect(trainingService.listCourses(AGENT)).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('quiz reads expose is_correct per course', () => {
  const quizData = {
    quiz: { id: 'q1', title: null, shuffle_questions: false, is_required: false },
    questions: [
      {
        id: 'qq1',
        text: 'Q',
        type: 'single',
        points: 1,
        position: 0,
        choices: [{ id: 'c1', text: 'A', position: 0, is_correct: true }],
      },
    ],
  };

  beforeEach(() => {
    quizRepo.findQuizWithQuestions.mockResolvedValue(quizData as never);
  });

  it('org_admin does NOT get is_correct for a global course', async () => {
    repo.findCourseById.mockResolvedValue(GLOBAL_PUBLISHED);
    const view = await trainingQuizService.getQuiz(COURSE_ID, ORG_ADMIN);
    expect(view.questions[0].choices[0]).not.toHaveProperty('isCorrect');
  });
  it('org_admin gets is_correct for an own-org course', async () => {
    repo.findCourseById.mockResolvedValue(OWN_PUBLISHED);
    const view = await trainingQuizService.getQuiz(COURSE_ID, ORG_ADMIN);
    expect(view.questions[0].choices[0]).toHaveProperty('isCorrect', true);
  });
  it('platform_admin gets is_correct for a global course', async () => {
    repo.findCourseById.mockResolvedValue(GLOBAL_PUBLISHED);
    const view = await trainingQuizService.getQuiz(COURSE_ID, PLATFORM);
    expect(view.questions[0].choices[0]).toHaveProperty('isCorrect', true);
  });
  it('agent never gets is_correct', async () => {
    repo.findCourseById.mockResolvedValue(OWN_PUBLISHED);
    const view = await trainingQuizService.getQuiz(COURSE_ID, AGENT);
    expect(view.questions[0].choices[0]).not.toHaveProperty('isCorrect');
  });
});
