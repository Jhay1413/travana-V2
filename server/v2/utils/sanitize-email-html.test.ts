import { describe, it, expect } from 'vitest';
import { sanitizeEmailHtml } from './sanitize-email-html';

describe('sanitizeEmailHtml', () => {
  it('strips script, iframe, object, embed, form and input', () => {
    const out = sanitizeEmailHtml(
      '<p>Hi</p><script>alert(1)</script><iframe src="https://x"></iframe><object data="x"></object><embed src="x"><form action="x"><input name="a"></form>',
    );
    expect(out).toBe('<p>Hi</p>');
  });

  it('strips on* handlers and style attributes', () => {
    const out = sanitizeEmailHtml('<img src="https://a.com/i.png" onerror="alert(1)" style="position:fixed"><p onclick="x()" style="color:red">t</p>');
    expect(out).not.toMatch(/onerror|onclick|style/i);
    expect(out).toContain('src="https://a.com/i.png"');
  });

  it('removes <style> blocks including their contents', () => {
    const out = sanitizeEmailHtml('<style>body{display:none}</style><p>text</p>');
    expect(out).toBe('<p>text</p>');
  });

  it('removes javascript: and data: URLs', () => {
    const out = sanitizeEmailHtml('<a href="javascript:alert(1)">x</a><img src="data:image/png;base64,AAAA">');
    expect(out).not.toMatch(/javascript:/i);
    expect(out).not.toMatch(/data:/i);
  });

  it('drops cid: image sources (client cannot resolve them)', () => {
    expect(sanitizeEmailHtml('<img src="cid:logo123" alt="logo">')).not.toContain('cid:');
  });

  it('keeps tables, https images and mailto links, forcing rel on links', () => {
    const out = sanitizeEmailHtml(
      '<table width="100%"><tr><td colspan="2">Cell</td></tr></table><img src="https://a.com/i.png" alt="x"><a href="mailto:a@b.com">mail</a><a href="https://a.com">web</a>',
    );
    expect(out).toContain('<table width="100%">');
    expect(out).toContain('<td colspan="2">Cell</td>');
    expect(out).toContain('<img src="https://a.com/i.png" alt="x" />');
    expect(out).toContain('href="mailto:a@b.com"');
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it('keeps plain text content', () => {
    expect(sanitizeEmailHtml('Hello <b>world</b>')).toBe('Hello <b>world</b>');
  });
});
