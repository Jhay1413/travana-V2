/** True when an attachment's MIME type should be rendered as an inline image (thumbnail/lightbox) rather than a file chip. */
export function isImageType(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}
