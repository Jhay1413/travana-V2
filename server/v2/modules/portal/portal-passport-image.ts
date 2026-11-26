import sharp from 'sharp';

export type PassportImageKind = 'jpeg' | 'png' | 'webp' | 'heic';

/** What the file really is, from its first bytes (the declared mime type is never trusted). Null = not a supported image. */
export function sniffImageKind(buffer: Buffer): PassportImageKind | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buffer.toString('ascii', 8, 12);
    if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand)) return 'heic';
  }
  return null;
}

/** Longest edge sent to the reader: plenty to read a passport page, small enough to be cheap and quick. */
export const PASSPORT_IMAGE_MAX_EDGE = 2000;
/** About 25 megapixels: more than any phone camera photo of a passport page needs, and a hard bound on decode memory. */
export const MAX_INPUT_PIXELS = 25_000_000;

/**
 * Applies the camera's rotation, shrinks to at most 2000px on the long edge and re-encodes as JPEG. Re-encoding drops
 * all metadata (EXIF, GPS), so only the pixels go on. Throws when sharp cannot decode the file (e.g. a HEIC build
 * without HEVC support, or a corrupt file). Works on the in-memory buffer only.
 */
export async function normalisePassportImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS })
    .rotate()
    .resize({ width: PASSPORT_IMAGE_MAX_EDGE, height: PASSPORT_IMAGE_MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer();
}
