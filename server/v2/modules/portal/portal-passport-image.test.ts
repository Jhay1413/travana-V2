import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { MAX_INPUT_PIXELS, normalisePassportImage, PASSPORT_IMAGE_MAX_EDGE, sniffImageKind } from './portal-passport-image';

async function photo(width: number, height: number, format: 'jpeg' | 'png' | 'webp'): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 200, b: 200 } } })[format]().toBuffer();
}

describe('sniffImageKind', () => {
  it('recognises JPEG, PNG and WebP by their first bytes', async () => {
    expect(sniffImageKind(await photo(10, 10, 'jpeg'))).toBe('jpeg');
    expect(sniffImageKind(await photo(10, 10, 'png'))).toBe('png');
    expect(sniffImageKind(await photo(10, 10, 'webp'))).toBe('webp');
  });

  it('recognises a HEIC container', () => {
    const heic = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypheic'), Buffer.alloc(16)]);
    expect(sniffImageKind(heic)).toBe('heic');
  });

  it('rejects everything else however it is named, including a PDF, a script and an empty file', () => {
    expect(sniffImageKind(Buffer.from('%PDF-1.7 ...'))).toBeNull();
    expect(sniffImageKind(Buffer.from('<?php echo 1;'))).toBeNull();
    expect(sniffImageKind(Buffer.from('GIF89a......'))).toBeNull();
    expect(sniffImageKind(Buffer.alloc(0))).toBeNull();
  });
});

describe('normalisePassportImage', () => {
  it('shrinks a large photo to 2000px on the long edge and re-encodes it as JPEG', async () => {
    const out = await normalisePassportImage(await photo(3000, 2000, 'png'));
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe('jpeg');
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(PASSPORT_IMAGE_MAX_EDGE);
  });

  it('never enlarges a small photo', async () => {
    const meta = await sharp(await normalisePassportImage(await photo(800, 600, 'jpeg'))).metadata();
    expect([meta.width, meta.height]).toEqual([800, 600]);
  });

  it('strips EXIF metadata', async () => {
    const withExif = await sharp({ create: { width: 50, height: 50, channels: 3, background: '#fff' } })
      .withExif({ IFD0: { Copyright: 'secret-owner' } })
      .jpeg()
      .toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined();
    const out = await normalisePassportImage(withExif);
    expect((await sharp(out).metadata()).exif).toBeUndefined();
    expect(out.includes(Buffer.from('secret-owner'))).toBe(false);
  });

  it('refuses an image over about 25 megapixels (a bound on decode memory)', async () => {
    expect(MAX_INPUT_PIXELS).toBe(25_000_000);
    await expect(normalisePassportImage(await photo(5100, 5100, 'png'))).rejects.toThrow();
    await expect(normalisePassportImage(await photo(4000, 4000, 'png'))).resolves.toBeDefined();
  });

  it('throws for a file that only looks like an image', async () => {
    await expect(normalisePassportImage(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from('not really a jpeg')]))).rejects.toThrow();
  });
});
