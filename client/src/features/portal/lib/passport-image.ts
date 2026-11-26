/** Longest edge of the photo sent to the server, and the JPEG quality it is saved at. */
export const PASSPORT_PHOTO_MAX_EDGE = 2000;
export const PASSPORT_PHOTO_JPEG_QUALITY = 0.85;

export interface PhotoSize {
  width: number;
  height: number;
}

/**
 * The size a photo is shrunk to: it keeps its shape, its longest edge is at most `maxEdge`, and it is never made
 * bigger. Pure so the maths can be tested without a browser.
 */
export function fitWithin(width: number, height: number, maxEdge: number = PASSPORT_PHOTO_MAX_EDGE): PhotoSize {
  if (!(width > 0) || !(height > 0)) return { width: 0, height: 0 };
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width: Math.round(width), height: Math.round(height) };
  const scale = maxEdge / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * Shrinks a camera photo in the browser before upload (a phone photo can be 5-10 MB) and re-encodes it as JPEG.
 * Drawing it on a canvas also drops its EXIF data. If the browser cannot decode the file, or the result would not
 * be smaller, the original file is sent unchanged and the server decides.
 */
export async function downscalePassportPhoto(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const size = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context || size.width === 0) {
      bitmap.close();
      return file;
    }
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", PASSPORT_PHOTO_JPEG_QUALITY));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}
