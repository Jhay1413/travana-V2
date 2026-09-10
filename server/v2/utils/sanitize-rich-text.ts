import sanitizeHtml from 'sanitize-html';

/**
 * Allow-list for user-authored rich text (ticket replies, chat messages …)
 * that is later rendered as HTML for OTHER users. Keeps the formatting the
 * rich-text editor produces and strips everything that could run script.
 */
export const richTextSanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'a', 'span', 'blockquote', 'code', 'pre', 'h1', 'h2', 'h3'],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    // External links open safely regardless of what the editor emitted.
    a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }),
  },
};

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, richTextSanitizeOptions);
}
