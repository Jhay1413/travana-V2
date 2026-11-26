import type { PortalDocument } from '@shared/portal-documents';
import type { PortalLinkedFileRow } from './portal-documents.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: string): boolean => UUID_PATTERN.test(value);

/** The categories staff can pick on the upload form, as the customer sees them. */
const CATEGORY_LABELS: Record<string, string> = {
  passport: 'Passport',
  tickets: 'Tickets',
  quote: 'Quote',
  invoice: 'Invoice',
  itinerary: 'Itinerary',
  insurance: 'Insurance',
  visa: 'Visa',
  other: 'Other',
};

/** A stored category as a display label: known values map to their plain label, unknown ones are tidied; blank is null. */
export function categoryLabel(raw: string | null): string | null {
  const tidy = (raw ?? '').replace(/[_\-\s]+/g, ' ').trim();
  if (!tidy) return null;
  const known = CATEGORY_LABELS[tidy.toLowerCase()];
  if (known) return known;
  const capped = tidy.slice(0, 60);
  return capped.charAt(0).toUpperCase() + capped.slice(1);
}

/** Lower-cased mime type without parameters ("Text/Plain; charset=utf-8" -> "text/plain"). */
const bareMime = (mime: string): string => mime.split(';')[0].trim().toLowerCase();

const KIND_BY_MIME: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/msword': 'Word document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word document',
  'application/vnd.ms-excel': 'Excel spreadsheet',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel spreadsheet',
  'application/vnd.ms-powerpoint': 'PowerPoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint',
  'text/plain': 'Text file',
  'text/csv': 'CSV file',
};

/** Short type label for the customer: "PDF", "Image", "Word document"... */
export function kindLabel(mimeType: string): string {
  const mime = bareMime(mimeType);
  if (KIND_BY_MIME[mime]) return KIND_BY_MIME[mime];
  if (mime.startsWith('image/')) return 'Image';
  return 'File';
}

/** Types a browser can only ever save or display as a document: no HTML, SVG, scripts or JSON. */
const SAFE_MIME_TYPES = new Set<string>([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
]);

/** The stored mime type when it is on the safe list, else a generic binary type that browsers will not render. */
export function safeContentType(mimeType: string): string {
  const mime = bareMime(mimeType);
  return SAFE_MIME_TYPES.has(mime) ? mime : 'application/octet-stream';
}

const MAX_FILE_NAME_LENGTH = 120;
// Control characters, line/paragraph separators, bidi overrides, zero-width marks and the BOM.
// eslint-disable-next-line no-control-regex
const UNSAFE_CHARS = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff"\\;%<>:*?|]/g;

/** A file name that is safe to put in a header and on the customer's disk: no path, quotes, line breaks or odd marks. */
export function sanitiseFileName(name: string): string {
  const lastSegment = name.split(/[\\/]/).pop() ?? '';
  let cleaned = lastSegment.replace(UNSAFE_CHARS, '').replace(/\s+/g, ' ').trim().replace(/^\.+/, '').trim();
  if (cleaned.length > MAX_FILE_NAME_LENGTH) {
    const dot = cleaned.lastIndexOf('.');
    const ext = dot > 0 && cleaned.length - dot <= 10 ? cleaned.slice(dot) : '';
    cleaned = cleaned.slice(0, MAX_FILE_NAME_LENGTH - ext.length).trimEnd() + ext;
  }
  return cleaned || 'document';
}

/** `attachment` header for an already sanitised name: an ASCII fallback plus the UTF-8 form (RFC 6266 / 5987). */
export function attachmentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_');
  const utf8 = encodeURIComponent(fileName).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}

/** The customer-facing document: an exact allowlist, never the row itself. */
export function toPortalDocument(row: PortalLinkedFileRow, bookingId: string | null): PortalDocument {
  return {
    id: row.id,
    name: (row.title ?? '').trim() || row.originalName,
    category: categoryLabel(row.category),
    kind: kindLabel(row.mimeType),
    sizeBytes: row.size,
    uploadedAt: row.createdAt.toISOString(),
    dealId: row.dealId,
    bookingId,
  };
}
