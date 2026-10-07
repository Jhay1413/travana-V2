import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./training-lesson.repository', () => ({
  trainingLessonRepository: {
    findAssetById: vi.fn(),
    findLessonById: vi.fn(),
    getNextAssetPosition: vi.fn(),
    createAssets: vi.fn(),
    deleteAsset: vi.fn(),
    countAssetsByUrl: vi.fn(),
    countLessonsByVideoUrl: vi.fn(),
  },
}));
vi.mock('./training.repository', () => ({
  trainingRepository: { countCoursesByThumbnailUrl: vi.fn() },
}));
vi.mock('./training.service', () => ({
  trainingService: { assertCourseEditable: vi.fn() },
}));
vi.mock('./training-section.service', () => ({ getSectionOrThrow: vi.fn() }));
vi.mock('../../utils/image-storage', () => ({
  uploadImageToS3: vi.fn(),
  deleteImageByStoredUrl: vi.fn(),
  buildImageProxyUrl: (key: string) => `/api/v2/files/img?key=${encodeURIComponent(key)}`,
  s3KeyFromStoredUrl: (u: string) =>
    u.startsWith('/api/v2/files/img?key=') ? decodeURIComponent(u.slice('/api/v2/files/img?key='.length)) : null,
}));

import { trainingLessonRepository } from './training-lesson.repository';
import { trainingRepository } from './training.repository';
import { trainingService } from './training.service';
import { deleteImageByStoredUrl } from '../../utils/image-storage';
import { trainingLessonService } from './training-lesson.service';

const lessonRepo = vi.mocked(trainingLessonRepository);
const courseRepo = vi.mocked(trainingRepository);
const courseService = vi.mocked(trainingService);
const s3Delete = vi.mocked(deleteImageByStoredUrl);

const urlFor = (key: string) => `/api/v2/files/img?key=${encodeURIComponent(key)}`;
const OWN_URL = urlFor('training-assets/123-own.png');
const FOREIGN_URL = urlFor('booking-images/victim-org/secret.png');

beforeEach(() => {
  vi.resetAllMocks();
  lessonRepo.findLessonById.mockResolvedValue({ id: 'l1', course_id: 'c1', type: 'graphics' } as never);
  lessonRepo.getNextAssetPosition.mockResolvedValue(0);
  lessonRepo.createAssets.mockImplementation(async (rows) => rows as never);
  lessonRepo.countAssetsByUrl.mockResolvedValue(0);
  lessonRepo.countLessonsByVideoUrl.mockResolvedValue(0);
  courseRepo.countCoursesByThumbnailUrl.mockResolvedValue(0);
});

describe('addAssetUrls rejects foreign S3 keys', () => {
  it('400 for a key outside training-assets/, nothing stored', async () => {
    await expect(
      trainingLessonService.addAssetUrls('l1', [{ assetUrl: FOREIGN_URL }], 'trusted' as never),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(lessonRepo.createAssets).not.toHaveBeenCalled();
  });
  it('400 for a training-videos key used as an asset', async () => {
    await expect(
      trainingLessonService.addAssetUrls('l1', [{ assetUrl: urlFor('training-videos/org/x.mp4') }], 'trusted' as never),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
  it('accepts a training-assets key and external https URLs', async () => {
    await trainingLessonService.addAssetUrls(
      'l1',
      [{ assetUrl: OWN_URL }, { assetUrl: 'https://cdn.example.com/a.png' }],
      'trusted' as never,
    );
    expect(lessonRepo.createAssets.mock.calls[0][0].map((r) => r.asset_url)).toEqual([
      OWN_URL,
      'https://cdn.example.com/a.png',
    ]);
  });
  it('foreign lesson yields 404 (course guard) before the graphics-type 400', async () => {
    lessonRepo.findLessonById.mockResolvedValue({ id: 'l1', course_id: 'c1', type: 'video' } as never);
    courseService.assertCourseEditable.mockRejectedValue(Object.assign(new Error('nf'), { statusCode: 404 }));
    await expect(
      trainingLessonService.addAssetUrls('l1', [{ assetUrl: OWN_URL }], 'trusted' as never),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('createLesson / updateLesson videoUrl prefix check', () => {
  it('updateLesson rejects a foreign-prefix videoUrl', async () => {
    lessonRepo.findLessonById.mockResolvedValue({ id: 'l1', course_id: 'c1', type: 'video', video_url: 'x' } as never);
    await expect(
      trainingLessonService.updateLesson('l1', { videoUrl: FOREIGN_URL }, 'trusted' as never),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('deleteAsset S3 cleanup guard', () => {
  const asset = (url: string) => ({ id: 'a1', lesson_id: 'l1', asset_url: url, caption: null, position: 0 });

  it('deletes an unreferenced training-assets object', async () => {
    lessonRepo.findAssetById.mockResolvedValue(asset(OWN_URL) as never);
    await trainingLessonService.deleteAsset('a1', 'trusted' as never);
    expect(lessonRepo.deleteAsset).toHaveBeenCalledWith('a1');
    expect(s3Delete).toHaveBeenCalledWith(OWN_URL);
  });
  it('does NOT delete when another asset row references the URL', async () => {
    lessonRepo.findAssetById.mockResolvedValue(asset(OWN_URL) as never);
    lessonRepo.countAssetsByUrl.mockResolvedValue(1);
    await trainingLessonService.deleteAsset('a1', 'trusted' as never);
    expect(lessonRepo.deleteAsset).toHaveBeenCalled();
    expect(s3Delete).not.toHaveBeenCalled();
  });
  it('does NOT delete when a lesson video or course thumbnail references the URL', async () => {
    lessonRepo.findAssetById.mockResolvedValue(asset(OWN_URL) as never);
    lessonRepo.countLessonsByVideoUrl.mockResolvedValue(1);
    await trainingLessonService.deleteAsset('a1', 'trusted' as never);
    courseRepo.countCoursesByThumbnailUrl.mockResolvedValue(1);
    lessonRepo.countLessonsByVideoUrl.mockResolvedValue(0);
    await trainingLessonService.deleteAsset('a1', 'trusted' as never);
    expect(s3Delete).not.toHaveBeenCalled();
  });
  it('does NOT delete a key outside the training prefix (legacy poisoned row)', async () => {
    lessonRepo.findAssetById.mockResolvedValue(asset(FOREIGN_URL) as never);
    await trainingLessonService.deleteAsset('a1', 'trusted' as never);
    expect(lessonRepo.deleteAsset).toHaveBeenCalled();
    expect(s3Delete).not.toHaveBeenCalled();
  });
  it('does NOT delete for external URLs', async () => {
    lessonRepo.findAssetById.mockResolvedValue(asset('https://cdn.example.com/a.png') as never);
    await trainingLessonService.deleteAsset('a1', 'trusted' as never);
    expect(s3Delete).not.toHaveBeenCalled();
  });
});
