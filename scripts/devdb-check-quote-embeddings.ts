import { sql } from "drizzle-orm";
import { db } from "../server/v2/config/database";

// One-off audit: is every FREE quote mirrored into the ai_embeddings vector
// store? Compares quote_table (isFreeQuote) against ai_embeddings
// (source_type='quote'), and lists how many free quotes are missing a vector
// row — split by whether their transaction even has an org (org-less free
// quotes are skipped by design).
async function main(): Promise<void> {
  const totals = await db.execute(sql`
    select
      (select count(*) from quote_table where "isFreeQuote" = true and deleted_at is null) as free_quotes,
      (select count(*) from ai_embeddings where source_type = 'quote') as quote_embeddings
  `);
  console.log("totals:", JSON.stringify(totals.rows?.[0]));

  const missing = await db.execute(sql`
    select
      count(*) filter (where t.org_id is not null) as missing_with_org,
      count(*) filter (where t.org_id is null) as missing_no_org
    from quote_table q
    left join transaction t on t.id = q.transaction_id
    where q."isFreeQuote" = true
      and q.deleted_at is null
      and not exists (select 1 from ai_embeddings e where e.source_type = 'quote' and e.source_id = q.id::text)
  `);
  console.log("free quotes WITHOUT an embedding:", JSON.stringify(missing.rows?.[0]));

  const recent = await db.execute(sql`
    select q.id, q.quote_ref, q.date_created::date as created, t.org_id is not null as has_org,
      exists (select 1 from ai_embeddings e where e.source_type = 'quote' and e.source_id = q.id::text) as embedded
    from quote_table q
    left join transaction t on t.id = q.transaction_id
    where q."isFreeQuote" = true and q.deleted_at is null
    order by q.date_created desc
    limit 10
  `);
  console.log("10 most recent free quotes:");
  for (const r of recent.rows ?? []) console.log(JSON.stringify(r));

  // Orphans: embeddings whose quote no longer exists (delete cleanup check).
  const orphans = await db.execute(sql`
    select count(*) as n from ai_embeddings e
    where e.source_type = 'quote'
      and not exists (select 1 from quote_table q where q.id::text = e.source_id and q.deleted_at is null)
  `);
  console.log("orphan quote embeddings (quote deleted but vector row remains):", JSON.stringify(orphans.rows?.[0]));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
