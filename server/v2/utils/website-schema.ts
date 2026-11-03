import { z } from 'zod';

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/** A website field: blank, or an http(s) URL (rejects javascript:, ftp:, bare domains). */
export const websiteSchema = z
  .string()
  .trim()
  .max(200)
  .refine((v) => v === '' || isHttpUrl(v), 'Website must be a valid http(s) URL, for example https://example.com');
