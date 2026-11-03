import sanitizeHtml from 'sanitize-html';

/**
 * Allow-list for INBOUND (third-party) email HTML that the client renders with
 * dangerouslySetInnerHTML. Keeps layout/formatting (tables, lists, images,
 * links) and strips anything that can run script or restyle the host page:
 * script/style/iframe/object/embed/form/input, every on* handler and every
 * style attribute. The client does not resolve cid: or data: images, so only
 * http(s) image sources survive; links allow http, https and mailto.
 */
export const emailSanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'hr', 'div', 'span', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'sub', 'sup', 'small', 'font', 'center',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption', 'colgroup', 'col',
    'a', 'img',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    table: ['width', 'border', 'cellpadding', 'cellspacing', 'align'],
    td: ['colspan', 'rowspan', 'width', 'align', 'valign'],
    th: ['colspan', 'rowspan', 'width', 'align', 'valign'],
    col: ['span', 'width'],
    colgroup: ['span', 'width'],
    font: ['color', 'size'],
    div: ['align'],
    p: ['align'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowProtocolRelative: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }),
  },
};

export function sanitizeEmailHtml(html: string): string {
  return sanitizeHtml(html, emailSanitizeOptions);
}
