import type { PageMeta } from "./page-meta.types";

/** Every value that goes into the page head passes through here. */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// The platform's own Open Graph / Twitter tags, and any existing title, description or robots tag.
const OWN_TAGS = /[ \t]*<meta\s+(?:property="og:[^"]*"|name="twitter:[^"]*"|name="description"|name="robots")[^>]*>[ \t]*\r?\n?/gi;
const OWN_TITLE = /[ \t]*<title>[\s\S]*?<\/title>[ \t]*\r?\n?/gi;

/** The head tags for a customer-facing page: neutral, escaped, never indexed. */
export function pageMetaTags(meta: PageMeta): string {
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const lines = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<meta name="robots" content="noindex" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta name="twitter:card" content="${meta.imageUrl ? "summary_large_image" : "summary"}" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
  ];
  if (meta.imageUrl) {
    const image = escapeHtml(meta.imageUrl);
    lines.push(`<meta property="og:image" content="${image}" />`, `<meta name="twitter:image" content="${image}" />`);
  }
  return lines.map((l) => `    ${l}`).join("\n");
}

/** Replaces the platform's own tags with the page's. HTML without a </head> is returned untouched. */
export function applyPageMeta(html: string, meta: PageMeta): string {
  if (!html.includes("</head>")) return html;
  const cleaned = html.replace(OWN_TAGS, "").replace(OWN_TITLE, "");
  return cleaned.replace("</head>", () => `${pageMetaTags(meta)}\n  </head>`);
}
