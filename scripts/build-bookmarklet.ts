// Minifies public/capture-bookmarklet.js into the single-line `javascript:` URL
// that agents drag onto their bookmarks bar.
//
//   npx tsx scripts/build-bookmarklet.ts
//
// Prints the one-liner and writes public/capture-bookmarklet.txt.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = resolve(process.cwd(), 'public/capture-bookmarklet.js');
// client/public is Vite's publicDir (vite.config.ts sets root: "client"), so the
// built one-liner is served at /capture-bookmarklet.txt for agents to install.
const OUT = resolve(process.cwd(), 'client/public/capture-bookmarklet.txt');

const source = readFileSync(SRC, 'utf8');

// Conservative squeeze: strip comments and collapse whitespace. Deliberately not
// a real minifier — the source stays readable and no build dependency is added.
const squeezed = source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:'"\\])\/\/.*$/gm, '$1')
  .split('\n')
  .map((l) => l.trim())
  .filter(Boolean)
  .join(' ')
  .replace(/\s{2,}/g, ' ')
  .replace(/\s*([{};(),:])\s*/g, '$1');

const bookmarklet = `javascript:${encodeURIComponent(squeezed)}`;

writeFileSync(OUT, bookmarklet, 'utf8');
console.log(bookmarklet);
console.log(`\n${(bookmarklet.length / 1024).toFixed(1)} KB — written to client/public/capture-bookmarklet.txt`);
