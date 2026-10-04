import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./training-lesson.repository', () => ({
  trainingLessonRepository: {
    findAssetById: vi.fn(),
    findLessonById: vi.fn(),
    updateAsset: vi.fn(),
    getNextAssetPosition: vi.fn(),
    createAssets: vi.fn(),
  },
}));
vi.mock('./training.service', () => ({
  trainingService: { assertCourseEditable: vi.fn() },
}));
vi.mock('./training-section.service', () => ({ getSectionOrThrow: vi.fn() }));
vi.mock('../../utils/image-storage', () => ({
  uploadImageToS3: vi.fn(),
  deleteImageByStoredUrl: vi.fn(),
}));

import { trainingLessonRepository } from './training-lesson.repository';
import { trainingService } from './training.service';
import { uploadImageToS3 } from '../../utils/image-storage';
import { trainingLessonService } from './training-lesson.service';
import { uploadAssetsValidator, parseValidatedCaptions } from './training-lesson.validator';

const repo = vi.mocked(trainingLessonRepository);
const courseService = vi.mocked(trainingService);
const s3 = vi.mocked(uploadImageToS3);

const LESSON_ID = '11111111-1111-4111-8111-111111111111';

function validate(captions?: string) {
  return uploadAssetsValidator.safeParse({
    params: { id: LESSON_ID },
    body: captions === undefined ? {} : { captions },
  });
}

describe('uploadAssetsValidator', () => {
  it('passes when captions are absent', () => {
    expect(validate().success).toBe(true);
  });

  it('passes a valid array of nullable strings', () => {
    expect(validate('["one",null,""]').success).toBe(true);
  });

  it('fails on invalid JSON', () => {
    expect(validate('{nope').success).toBe(false);
  });

  it('fails on a non-array', () => {
    expect(validate('{"a":1}').success).toBe(false);
  });

  it('fails on a non-string element', () => {
    expect(validate('[1]').success).toBe(false);
  });

  it('fails on an over-long element (measured after trim)', () => {
    expect(validate(JSON.stringify(['x'.repeat(2001)])).success).toBe(false);
    expect(validate(JSON.stringify([`  ${'x'.repeat(2000)}  `])).success).toBe(true);
  });

  it('parseValidatedCaptions returns undefined when absent and an array when present', () => {
    expect(parseValidatedCaptions(undefined)).toBeUndefined();
    expect(parseValidatedCaptions('["a",null]')).toEqual(['a', null]);
  });
});

describe('trainingLessonService.uploadAssets', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    repo.findLessonById.mockResolvedValue({ id: 'l1', course_id: 'c1', type: 'graphics' } as never);
    repo.getNextAssetPosition.mockResolvedValue(3);
    repo.createAssets.mockImplementation(async (rows) => rows as never);
    s3.mockImplementation(async (file) => `url-${(file as { originalname: string }).originalname}`);
  });

  const files = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ originalname: `f${i}` }) as unknown as Express.Multer.File);

  it('trims captions per index, blank to null, and null past a shorter array', async () => {
    await trainingLessonService.uploadAssets('l1', files(4), 'trusted' as never, ['  hi  ', '   ', null]);

    const rows = repo.createAssets.mock.calls[0][0];
    expect(rows.map((r) => r.caption)).toEqual(['hi', null, null, null]);
    expect(rows.map((r) => r.position)).toEqual([3, 4, 5, 6]);
  });

  it('uses null captions when none are provided', async () => {
    await trainingLessonService.uploadAssets('l1', files(2), 'trusted' as never);
    expect(repo.createAssets.mock.calls[0][0].map((r) => r.caption)).toEqual([null, null]);
  });

  it('rejects more captions than files with 400 before any S3 upload', async () => {
    await expect(
      trainingLessonService.uploadAssets('l1', files(1), 'trusted' as never, ['a', 'b']),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(s3).not.toHaveBeenCalled();
    expect(repo.createAssets).not.toHaveBeenCalled();
  });
});

describe('trainingLessonService.updateAsset', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const asset = { id: 'a1', lesson_id: 'l1', asset_url: 'u', caption: null, position: 0 };

  it('404s when the asset does not exist', async () => {
    repo.findAssetById.mockResolvedValue(undefined);
    await expect(trainingLessonService.updateAsset('a1', { caption: 'x' }, 'trusted' as never)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(repo.updateAsset).not.toHaveBeenCalled();
  });

  it('trims the caption and checks the course is editable', async () => {
    repo.findAssetById.mockResolvedValue(asset as never);
    repo.findLessonById.mockResolvedValue({ id: 'l1', course_id: 'c1' } as never);
    repo.updateAsset.mockResolvedValue({ ...asset, caption: 'hello' } as never);

    const result = await trainingLessonService.updateAsset('a1', { caption: '  hello  ' }, 'trusted' as never);

    expect(courseService.assertCourseEditable).toHaveBeenCalledWith('c1', 'trusted');
    expect(repo.updateAsset).toHaveBeenCalledWith('a1', { caption: 'hello' });
    expect(result.caption).toBe('hello');
  });

  it('stores null for a blank caption', async () => {
    repo.findAssetById.mockResolvedValue(asset as never);
    repo.findLessonById.mockResolvedValue({ id: 'l1', course_id: 'c1' } as never);
    repo.updateAsset.mockResolvedValue(asset as never);

    await trainingLessonService.updateAsset('a1', { caption: '   ' }, 'trusted' as never);

    expect(repo.updateAsset).toHaveBeenCalledWith('a1', { caption: null });
  });

  it('propagates assertCourseEditable rejection and does not update', async () => {
    repo.findAssetById.mockResolvedValue(asset as never);
    repo.findLessonById.mockResolvedValue({ id: 'l1', course_id: 'c1' } as never);
    courseService.assertCourseEditable.mockRejectedValue(Object.assign(new Error('locked'), { statusCode: 403 }));

    await expect(trainingLessonService.updateAsset('a1', { caption: 'x' }, 'trusted' as never)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(repo.updateAsset).not.toHaveBeenCalled();
  });
});
