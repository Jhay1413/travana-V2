import { describe, it, expect } from "vitest";
import { applyPageMeta, escapeHtml, pageMetaTags } from "./page-meta.html";

const TEMPLATE = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta property="og:title" content="Travana — The Operating System for Travel Agents" />
    <meta property="og:description" content="Travel Agent Growth Hub by Travana." />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="https://replit.com/public/images/opengraph.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@replit" />
    <meta name="twitter:title" content="Travana" />
    <meta name="twitter:description" content="Travana" />
    <meta name="twitter:image" content="https://replit.com/public/images/opengraph.png" />
    <link rel="icon" type="image/png" href="/favicon.png" />
  </head>
  <body><div id="root"></div></body>
</html>`;

describe("escapeHtml", () => {
  it("escapes the five characters that matter in text and attributes", () => {
    expect(escapeHtml(`<b>"Tom & Jerry's"</b>`)).toBe("&lt;b&gt;&quot;Tom &amp; Jerry&#39;s&quot;&lt;/b&gt;");
  });
});

describe("applyPageMeta", () => {
  const meta = { title: "Sunny Travel — your holiday quote", description: "Open to see the details.", imageUrl: "https://cdn.example/logo.png" };

  it("replaces every platform tag, adds noindex, and keeps the rest of the page", () => {
    const html = applyPageMeta(TEMPLATE, meta);
    expect(html).not.toMatch(/Travana|replit|Operating System/);
    expect(html).toContain("<title>Sunny Travel — your holiday quote</title>");
    expect(html).toContain('<meta name="robots" content="noindex" />');
    expect(html).toContain('<meta property="og:title" content="Sunny Travel — your holiday quote" />');
    expect(html).toContain('<meta property="og:image" content="https://cdn.example/logo.png" />');
    expect(html).toContain('<meta charset="UTF-8" />');
    expect(html).toContain('<link rel="icon" type="image/png" href="/favicon.png" />');
    expect(html).toContain('<div id="root"></div>');
    expect(html.match(/og:title/g)).toHaveLength(1);
  });

  it("no image tags without an image", () => {
    const html = applyPageMeta(TEMPLATE, { ...meta, imageUrl: null });
    expect(html).not.toMatch(/og:image|twitter:image/);
    expect(html).toContain('content="summary"');
  });

  it("escapes every value, so an agency name cannot break out of the tag", () => {
    const hostile = { title: `"><script>alert(1)</script> & Co`, description: `'x'<y>`, imageUrl: `https://cdn.example/a.png?x="><img src=x>` };
    const tags = pageMetaTags(hostile);
    expect(tags).not.toContain("<script>");
    expect(tags).not.toMatch(/<img/);
    expect(tags).toContain("&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt; &amp; Co");
    expect(applyPageMeta(TEMPLATE, hostile)).not.toContain("<script>");
  });

  it("returns HTML with no head untouched", () => {
    expect(applyPageMeta("<p>x</p>", meta)).toBe("<p>x</p>");
  });
});
