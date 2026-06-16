#!/usr/bin/env node
// Regenerates the auto-generated "Live facts" block in the planner's
// architecture context doc from the live codebase.
//
//   npm run docs:arch
//
// Only the content between <!-- AUTO:START --> and <!-- AUTO:END --> is rewritten;
// the curated analysis in the rest of the doc is left untouched.

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOC = join(ROOT, ".claude/agents/context/architecture.md");
const START = "<!-- AUTO:START -->";
const END = "<!-- AUTO:END -->";

const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : "");
const exists = (p) => existsSync(join(ROOT, p));

// --- gather facts -----------------------------------------------------------

const pkg = JSON.parse(read(join(ROOT, "package.json")) || "{}");
const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
const ver = (name) => (deps[name] ? deps[name].replace(/^[\^~]/, "") : "—");

const listDir = (rel) => {
  const p = join(ROOT, rel);
  if (!existsSync(p)) return [];
  return readdirSync(p, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
};

const modules = listDir("server/v2/modules");
const migrations = existsSync(join(ROOT, "migrations"))
  ? readdirSync(join(ROOT, "migrations")).filter((f) => f.endsWith(".sql")).sort()
  : [];
const latestMigration = migrations.length ? migrations[migrations.length - 1] : "—";

const schema = read(join(ROOT, "shared/schema.ts"));
const orgIdRefs = (schema.match(/orgId|org_id/g) || []).length;
const tableDefs = (schema.match(/pgTable\(/g) || []).length;
const enumDefs = (schema.match(/pgEnum\(/g) || []).length;

const scriptNames = Object.keys(pkg.scripts || {});
const hasTestRunner = scriptNames.includes("test") ||
  ["jest", "vitest", "mocha", "@playwright/test"].some((d) => deps[d]);

const clientPages = listDir("client/src/pages").length ||
  (existsSync(join(ROOT, "client/src/pages"))
    ? readdirSync(join(ROOT, "client/src/pages")).filter((f) => f.endsWith(".tsx")).length
    : 0);

const hasV1 = exists("server/index.ts") || exists("server/routes.ts") ||
  (exists("server") && !["v2"].every((x) => false));

// --- render -----------------------------------------------------------------

const stamp = new Date().toISOString().slice(0, 10);

const facts = `${START}
<!-- Run \`npm run docs:arch\` to regenerate this block from the live codebase. -->
**Last refreshed:** ${stamp} (auto-generated — do not edit by hand)

| Fact | Value |
|------|-------|
| Backend modules (\`server/v2/modules/\`) | **${modules.length}** |
| Tables defined (\`pgTable\`) in schema.ts | ${tableDefs} |
| Enums (\`pgEnum\`) in schema.ts | ${enumDefs} |
| \`orgId\`/\`org_id\` references in schema.ts | ${orgIdRefs} |
| Migrations (\`migrations/*.sql\`) | ${migrations.length} (latest: \`${latestMigration}\`) |
| Client pages (\`client/src/pages\`) | ~${clientPages} |
| Automated test runner | ${hasTestRunner ? "✅ present" : "⚠️ NONE (only `npm run check` / tsc)"} |
| Legacy v1 backend (\`server/\`) present | ${hasV1 ? "⚠️ yes (alongside v2)" : "no"} |

**Key versions:** React ${ver("react")} · TypeScript ${ver("typescript")} · Vite ${ver("vite")} · Express ${ver("express")} · Drizzle ORM ${ver("drizzle-orm")} · Zod ${ver("zod")} · React Query ${ver("@tanstack/react-query")}

**Backend modules:** ${modules.join(", ") || "—"}
${END}`;

// --- write back -------------------------------------------------------------

let doc = read(DOC);
if (!doc) {
  console.error(`Cannot find ${DOC}`);
  process.exit(1);
}
const s = doc.indexOf(START);
const e = doc.indexOf(END);
if (s === -1 || e === -1) {
  console.error(`Markers ${START} / ${END} not found in ${DOC}`);
  process.exit(1);
}
doc = doc.slice(0, s) + facts + doc.slice(e + END.length);
writeFileSync(DOC, doc);

console.log(`Refreshed architecture doc (${stamp}): ${modules.length} modules, ${tableDefs} tables, ${migrations.length} migrations.`);
