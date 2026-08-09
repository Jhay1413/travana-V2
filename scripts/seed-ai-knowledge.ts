/**
 * Seeds an organisation's AI "brain": the bot config (persona, tone, handoff
 * policy and reply RULES) plus its knowledge base entries.
 *
 *   npm run db:seed-ai-knowledge -- --dry-run        # show the plan, write nothing
 *   npm run db:seed-ai-knowledge                     # insert what's missing
 *   npm run db:seed-ai-knowledge -- --overwrite      # replace existing too
 *   npm run db:seed-ai-knowledge -- --org=<uuid>     # target a specific org
 *   npm run db:seed-ai-knowledge -- --org-name="X"   # target by name
 *
 * ORGANISATION RESOLUTION. Organisation UUIDs are not stable across databases,
 * so the seed data carries a NAME, not an id. Resolution order:
 *   1. --org=<uuid>            exact, wins outright
 *   2. --org-name="..."        by name
 *   3. sourceOrgName           the name from the source database
 *   4. the only organisation   if the target database has exactly one
 * Anything ambiguous lists the candidates and exits without writing, because
 * seeding another agency's persona onto the wrong org is not something you want
 * to discover from customer replies.
 *
 * created_by / updated_by are left NULL: the user ids in the source database
 * do not exist here, and a bad FK would fail the whole run.
 *
 * To refresh the seed data from a database you've curated, re-run the export
 * that generated scripts/seed-data/ai-knowledge.ts.
 */
import { and, eq } from "drizzle-orm";
import { db } from "../server/v2/config/database";
import { orgBotConfig, orgKnowledgeBase, organization } from "../shared/schema";
import { botConfigSeed, knowledgeBaseSeed, sourceOrgName } from "./seed-data/ai-knowledge";

const OVERWRITE = process.argv.includes("--overwrite");
const DRY_RUN = process.argv.includes("--dry-run");
const argValue = (flag: string): string | undefined =>
  process.argv.find((a) => a.startsWith(`${flag}=`))?.split("=").slice(1).join("=").replace(/^["']|["']$/g, "");

async function resolveOrg(): Promise<{ id: string; name: string }> {
  const all = await db.select({ id: organization.id, name: organization.name }).from(organization);
  const bail = (msg: string): never => {
    console.error(`${msg}\n\nOrganisations in this database:`);
    for (const o of all) console.error(`  ${o.id}  ${o.name}`);
    console.error(`\nRe-run with --org=<uuid> to choose one.`);
    process.exit(1);
  };

  const byId = argValue("--org");
  if (byId) {
    const hit = all.find((o) => o.id === byId);
    return hit ?? bail(`No organisation with id "${byId}".`);
  }

  const wanted = argValue("--org-name") ?? sourceOrgName;
  const named = all.filter((o) => o.name?.trim().toLowerCase() === wanted.trim().toLowerCase());
  if (named.length === 1) return named[0];
  if (named.length > 1) return bail(`"${wanted}" matches ${named.length} organisations — ambiguous.`);

  if (all.length === 1) {
    console.log(`No organisation named "${wanted}"; this database has exactly one, using it.`);
    return all[0];
  }
  return bail(`No organisation named "${wanted}".`);
}

async function main() {
  const org = await resolveOrg();
  console.log(`Target org: ${org.name} (${org.id})`);
  console.log(`${DRY_RUN ? "[dry run] " : ""}${OVERWRITE ? "overwrite mode" : "insert-missing mode"}\n`);

  // ── Bot config: persona + rules ──────────────────────────────────────────
  const [existingBot] = await db.select().from(orgBotConfig).where(eq(orgBotConfig.orgId, org.id));
  const ruleCount = botConfigSeed.rules?.length ?? 0;

  if (existingBot && !OVERWRITE) {
    console.log(`  skip      bot config      already present (${(existingBot.rules as unknown[])?.length ?? 0} rules) — use --overwrite to replace`);
  } else {
    console.log(`  ${existingBot ? "overwrite" : "insert   "} bot config      "${botConfigSeed.name}", ${ruleCount} rules`);
    if (!DRY_RUN) {
      const values = {
        orgId: org.id,
        name: botConfigSeed.name,
        avatarUrl: botConfigSeed.avatar_url,
        persona: botConfigSeed.persona,
        preferredResponse: botConfigSeed.preferred_response,
        greeting: botConfigSeed.greeting,
        signOff: botConfigSeed.sign_off,
        language: botConfigSeed.language,
        handoffInstructions: botConfigSeed.handoff_instructions,
        rules: botConfigSeed.rules,
      };
      await db
        .insert(orgBotConfig)
        .values(values)
        .onConflictDoUpdate({
          target: orgBotConfig.orgId,
          set: { ...values, updatedAt: new Date() },
        });
    }
  }

  // ── Knowledge base ───────────────────────────────────────────────────────
  // Matched on title within the org: there is no unique constraint to conflict
  // on, and title is what a human uses to identify an entry.
  const existing = await db
    .select({ id: orgKnowledgeBase.id, title: orgKnowledgeBase.title })
    .from(orgKnowledgeBase)
    .where(eq(orgKnowledgeBase.orgId, org.id));
  const byTitle = new Map(existing.map((r) => [r.title.trim().toLowerCase(), r.id]));

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const entry of knowledgeBaseSeed) {
    const current = byTitle.get(entry.title.trim().toLowerCase());
    const label = `[${entry.category ?? "-"}]`.padEnd(22);

    if (current && !OVERWRITE) {
      skipped++;
      continue;
    }
    if (current) {
      console.log(`  overwrite ${label} ${entry.title}`);
      updated++;
      if (!DRY_RUN) {
        await db
          .update(orgKnowledgeBase)
          .set({
            content: entry.content,
            category: entry.category,
            audience: entry.audience,
            isActive: entry.is_active,
            updatedAt: new Date(),
          })
          .where(and(eq(orgKnowledgeBase.id, current), eq(orgKnowledgeBase.orgId, org.id)));
      }
    } else {
      console.log(`  insert    ${label} ${entry.title}`);
      inserted++;
      if (!DRY_RUN) {
        await db.insert(orgKnowledgeBase).values({
          orgId: org.id,
          title: entry.title,
          content: entry.content,
          category: entry.category,
          audience: entry.audience,
          isActive: entry.is_active,
        });
      }
    }
  }

  if (skipped) console.log(`  skip      ${skipped} knowledge entries already present`);
  console.log(
    `\n${DRY_RUN ? "[dry run] " : ""}knowledge base: ${inserted} inserted, ${updated} overwritten, ${skipped} skipped.`,
  );
  if (skipped > 0 && !OVERWRITE) console.log("Re-run with --overwrite to replace the existing entries.");

  // Rows written here go straight to the table, so the create/edit hook that
  // embeds an entry never fires. Without embeddings the entries exist but are
  // invisible to the assistant's retrieval — which looks like the seed silently
  // not working, so say it out loud rather than leave it to be discovered.
  if (inserted + updated > 0) {
    console.log("\nNEXT: these entries have no embeddings yet, so the assistant cannot retrieve them.");
    console.log("      Run  npm run db:backfill-kb-embeddings   (needs OPENAI_API_KEY).");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
