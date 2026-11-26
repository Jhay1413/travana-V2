import sanitizeHtml from 'sanitize-html';

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };
const BLOCK_ENDS = ['</p>', '</div>', '</li>', '</h1>', '</h2>', '</h3>', '</blockquote>', '</pre>'];

/**
 * A staff chat message (rich text from the editor, e.g. "<p>Hello</p><p>See you &amp; soon</p>") as the plain text a
 * customer reads in their portal: paragraphs and <br> become line breaks, every tag is removed by a real HTML parser
 * (not a backtracking pattern), and the entities the parser leaves are turned back into characters.
 */
export function richTextToPlainText(html: string): string {
  // Pass 1 normalises the markup (closing tags, <br />) so the markers below are exactly what the parser prints.
  let marked = sanitizeHtml(html, { allowedTags: ['br', ...BLOCK_ENDS.map((t) => t.slice(2, -1))], allowedAttributes: {} });
  marked = marked.split('<br />').join('\n').split('<br>').join('\n');
  for (const end of BLOCK_ENDS) marked = marked.split(end).join('\n');
  // Pass 2 removes whatever tags are left; the text is entity-escaped, so decode it back.
  const text = sanitizeHtml(marked, { allowedTags: [], allowedAttributes: {} }).replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (e) => ENTITIES[e] ?? e);
  return text
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
