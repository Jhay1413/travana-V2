import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./training.repository', () => ({
  trainingRepository: {
    findCourseById: vi.fn(),
    deleteCourse: vi.fn(),
    updateCourse: vi.fn(),
    setCourseStatus: vi.fn(),
    countCoursesByThumbnailUrl: vi.fn(),
  },
}));
vi.mock('./training-section.repository', () => ({
  trainingSectionRepository: {
    findSectionById: vi.fn(),
    deleteSection: vi.fn(),
    updateSection: vi.fn(),
    createSection: vi.fn(),
    getNextSectionPosition: vi.fn(),
  },
}));
vi.mock('./training-lesson.repository', () => ({
  trainingLessonRepository: {
    findLessonById: vi.fn(),
    deleteLesson: vi.fn(),
    updateLesson: vi.fn(),
    createLesson: vi.fn(),
    countAssetsByUrl: vi.fn(),
    countLessonsByVideoUrl: vi.fn(),
  },
}));
vi.mock('./training-quiz.repository', () => ({
  trainingQuizRepository: {
    upsertQuizTree: vi.fn(),
    findQuizWithQuestionsByLessonId: vi.fn(),
    findQuizWithQuestionsBySectionId: vi.fn(),
    findQuizWithQuestions: vi.fn(),
  },
}));
vi.mock('./training-progress.repository', () => ({
  trainingProgressRepository: {
    findOrCreateEnrollment: vi.fn(),
    findEnrollment: vi.fn(),
    upsertProgress: vi.fn(),
  },
}));
vi.mock('../../utils/image-storage', () => ({
  uploadImageToS3: vi.fn(),
  deleteImageByStoredUrl: vi.fn(),
  getPresignedPutUrl: vi.fn(async () => 'https://put.example'),
  buildImageProxyUrl: (key: string) => `/api/v2/files/img?key=${encodeURIComponent(key)}`,
  s3KeyFromStoredUrl: () => null,
}));

import { trainingRepository } from './training.repository';
import { trainingSectionRepository } from './training-section.repository';
import { trainingLessonRepository } from './training-lesson.repository';
import { trainingQuizRepository } from './training-quiz.repository';
import { trainingProgressRepository } from './training-progress.repository';
import { getPresignedPutUrl } from '../../utils/image-storage';
import { trainingService } from './training.service';
import { trainingSectionService } from './training-section.service';
import { trainingLessonService } from './training-lesson.service';
import { trainingQuizService } from './training-quiz.service';
import { trainingProgressService } from './training-progress.service';
import { trainingUploadService } from './training-upload.service';
import type { Scope, OrgRole } from '../../utils/scope';
import type { TrainingCourse } from '@shared/schema';

const courseRepo = vi.mocked(trainingRepository);
const sectionRepo = vi.mocked(trainingSectionRepository);
const lessonRepo = vi.mocked(trainingLessonRepository);
const quizRepo = vi.mocked(trainingQuizRepository);
const progressRepo = vi.mocked(trainingProgressRepository);

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';

function scopeOf(orgRole: OrgRole, orgId: string = ORG_A): Scope {
  return { orgId, branchId: null, orgRole, orgRoles: [orgRole], userId: 'user-1' };
}
const ORG_ADMIN = scopeOf('org_admin');
const AGENT = scopeOf('agent');
const PLATFORM = scopeOf('platform_admin', '');

function course(over: Partial<TrainingCourse> = {}): TrainingCourse {
  return {
    id: 'c1',
    title: 'T',
    category: 'Sales',
    visibility: 'org',
    org_id: ORG_A,
    status: 'published',
    passing_score: 80,
    require_content_before_quiz: true,
    ...over,
  } as TrainingCourse;
}
const GLOBAL_PUBLISHED = course({ visibility: 'global', org_id: null });
const FOREIGN = course({ org_id: ORG_B });
const OWN_DRAFT = course({ status: 'draft' });

const SECTION = { id: 's1', course_id: 'c1' };
const LESSON = { id: 'l1', course_id: 'c1', section_id: 's1', type: 'graphics', video_url: null };
const QUIZ_INPUT = {
  questions: [
    {
      text: 'Q',
      type: 'single' as const,
      choices: [
        { text: 'A', isCorrect: true },
        { text: 'B', isCorrect: false },
      ],
    },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
  sectionRepo.findSectionById.mockResolvedValue(SECTION as never);
  lessonRepo.findLessonById.mockResolvedValue(LESSON as never);
});

describe('foreign-org delete', () => {
  it('org_admin deleting another org course: 404 and repo.deleteCourse not called', async () => {
    courseRepo.findCourseById.mockResolvedValue(FOREIGN);
    await expect(trainingService.deleteCourse('c1', ORG_ADMIN)).rejects.toMatchObject({ statusCode: 404 });
    expect(courseRepo.deleteCourse).not.toHaveBeenCalled();
  });
});

describe('sub-resource mutations on a global course as org_admin', () => {
  beforeEach(() => {
    courseRepo.findCourseById.mockResolvedValue(GLOBAL_PUBLISHED);
  });

  it('section delete / create: 404, repo untouched', async () => {
    await expect(trainingSectionService.deleteSection('s1', ORG_ADMIN)).rejects.toMatchObject({ statusCode: 404 });
    await expect(trainingSectionService.createSection('c1', { title: 'x' }, ORG_ADMIN)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(sectionRepo.deleteSection).not.toHaveBeenCalled();
    expect(sectionRepo.createSection).not.toHaveBeenCalled();
  });

  it('lesson delete / update: 404, repo untouched', async () => {
    await expect(trainingLessonService.deleteLesson('l1', ORG_ADMIN)).rejects.toMatchObject({ statusCode: 404 });
    await expect(trainingLessonService.updateLesson('l1', { title: 'x' }, ORG_ADMIN)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(lessonRepo.deleteLesson).not.toHaveBeenCalled();
    expect(lessonRepo.updateLesson).not.toHaveBeenCalled();
  });

  it('quiz upserts (course / lesson / section): 404, repo untouched', async () => {
    await expect(trainingQuizService.upsertQuiz('c1', QUIZ_INPUT, ORG_ADMIN)).rejects.toMatchObject({ statusCode: 404 });
    await expect(trainingQuizService.upsertLessonQuiz('l1', QUIZ_INPUT, ORG_ADMIN)).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(trainingQuizService.upsertSectionQuiz('s1', QUIZ_INPUT, ORG_ADMIN)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(quizRepo.upsertQuizTree).not.toHaveBeenCalled();
  });

  it('lesson / section quiz GETs do not expose is_correct to org_admin', async () => {
    const quizData = {
      quiz: { id: 'q1', title: null, shuffle_questions: false, is_required: false },
      questions: [
        {
          id: 'qq',
          text: 'Q',
          type: 'single',
          points: 1,
          position: 0,
          choices: [{ id: 'c', text: 'A', position: 0, is_correct: true }],
        },
      ],
    };
    quizRepo.findQuizWithQuestionsByLessonId.mockResolvedValue(quizData as never);
    quizRepo.findQuizWithQuestionsBySectionId.mockResolvedValue(quizData as never);
    const lessonView = await trainingQuizService.getLessonQuiz('l1', ORG_ADMIN);
    const sectionView = await trainingQuizService.getSectionQuiz('s1', ORG_ADMIN);
    expect(lessonView.questions[0].choices[0]).not.toHaveProperty('isCorrect');
    expect(sectionView.questions[0].choices[0]).not.toHaveProperty('isCorrect');
  });
});

describe('own-org course as org_admin', () => {
  it('section delete is allowed', async () => {
    courseRepo.findCourseById.mockResolvedValue(course());
    await trainingSectionService.deleteSection('s1', ORG_ADMIN);
    expect(sectionRepo.deleteSection).toHaveBeenCalledWith('s1');
  });
});

describe('learner flows ignore authoring access (S3)', () => {
  beforeEach(() => {
    courseRepo.findCourseById.mockResolvedValue(OWN_DRAFT);
  });

  it('org_admin enroll on own-org draft: 404', async () => {
    await expect(trainingProgressService.enroll('c1', ORG_ADMIN)).rejects.toMatchObject({ statusCode: 404 });
    expect(progressRepo.findOrCreateEnrollment).not.toHaveBeenCalled();
  });
  it('org_admin my-status on own-org draft: 404', async () => {
    await expect(trainingProgressService.getMyStatus('c1', ORG_ADMIN)).rejects.toMatchObject({ statusCode: 404 });
  });
  it('org_admin quiz attempt on own-org draft: 404', async () => {
    await expect(trainingQuizService.submitAttempt('c1', { answers: [] }, ORG_ADMIN)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(progressRepo.findOrCreateEnrollment).not.toHaveBeenCalled();
  });
  it('platform_admin still bypasses the published check on enroll', async () => {
    progressRepo.findOrCreateEnrollment.mockResolvedValue({ enrollment: {}, created: true } as never);
    await trainingProgressService.enroll('c1', PLATFORM);
    expect(progressRepo.findOrCreateEnrollment).toHaveBeenCalled();
  });
  it('org_admin can still enroll in a published global course', async () => {
    courseRepo.findCourseById.mockResolvedValue(GLOBAL_PUBLISHED);
    progressRepo.findOrCreateEnrollment.mockResolvedValue({ enrollment: {}, created: true } as never);
    await trainingProgressService.enroll('c1', ORG_ADMIN);
    expect(progressRepo.findOrCreateEnrollment).toHaveBeenCalled();
  });
});

describe('updateLessonProgress course visibility (S2)', () => {
  it('404s and creates no enrollment for a lesson of an out-of-scope course', async () => {
    courseRepo.findCourseById.mockResolvedValue(FOREIGN);
    await expect(trainingProgressService.updateLessonProgress('l1', { completed: true }, AGENT)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(progressRepo.findOrCreateEnrollment).not.toHaveBeenCalled();
    expect(progressRepo.upsertProgress).not.toHaveBeenCalled();
  });
  it('404s for a draft course lesson as learner', async () => {
    courseRepo.findCourseById.mockResolvedValue(OWN_DRAFT);
    await expect(trainingProgressService.updateLessonProgress('l1', { completed: true }, AGENT)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(progressRepo.findOrCreateEnrollment).not.toHaveBeenCalled();
  });
});

describe('presign', () => {
  const input = { fileName: 'a.mp4', contentType: 'video/mp4', kind: 'video' as const };

  it('403 for an agent scope, no URL minted', async () => {
    await expect(trainingUploadService.presignUpload(input, AGENT)).rejects.toMatchObject({ statusCode: 403 });
    expect(getPresignedPutUrl).not.toHaveBeenCalled();
  });
  it('puts the org in the key for org_admin, "platform" for platform_admin', async () => {
    const own = await trainingUploadService.presignUpload(input, ORG_ADMIN);
    expect(own.key.startsWith(`training-videos/${ORG_A}/`)).toBe(true);
    const plat = await trainingUploadService.presignUpload(
      { ...input, kind: 'image', contentType: 'image/png' },
      PLATFORM,
    );
    expect(plat.key.startsWith('training-thumbnails/platform/')).toBe(true);
  });
});
