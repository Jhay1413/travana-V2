/**
 * Backfill ai_embeddings for travel deals already SCHEDULED/POSTED to Facebook
 * (travel_deal rows with onlySocialsId set), sourceType "deal".
 *
 * Going forward, social-post.service keeps these in sync on schedule/
 * reschedule/edit/unschedule — this script covers everything posted before
 * that hook existed. Safe to re-run — aiEmbeddingsRepository.upsert is
 * idempotent on (org_id, source_type, source_id).
 *
 *   npm run db:backfill-deal-embeddings
 */
import { socialPostRepository } from "../server/v2/modules/social-post/social-post.repository";
import { aiEmbeddingsRepository } from "../server/v2/modules/ai-embeddings/ai-embeddings.repository";
import { embedBatch } from "../server/v2/utils/embeddings";
import { buildDealEmbeddingText, buildDealEmbeddingMetadata } from "../server/v2/modules/social-post/deal-embedding";

const BATCH_SIZE = 50;

async function main() {
  console.log("Backfilling deal embeddings for scheduled travel deals...");

  let offset = 0;
  let totalSeen = 0;
  let totalEmbedded = 0;
  let totalSkippedEmpty = 0;

  for (;;) {
    const rows = await socialPostRepository.findScheduledDealEmbeddingRows(offset, BATCH_SIZE);
    if (rows.length === 0) break;

    totalSeen += rows.length;

    const embeddableRows: typeof rows = [];
    const embeddableTexts: string[] = [];
    for (const row of rows) {
      const text = buildDealEmbeddingText(row.deal);
      if (text.trim()) {
        embeddableRows.push(row);
        embeddableTexts.push(text);
      } else {
        totalSkippedEmpty++;
      }
    }

    if (embeddableTexts.length > 0) {
      const vectors = await embedBatch(embeddableTexts);
      for (let i = 0; i < embeddableRows.length; i++) {
        const row = embeddableRows[i];
        await aiEmbeddingsRepository.upsert({
          orgId: row.orgId,
          sourceType: "deal",
          sourceId: row.deal.id,
          content: embeddableTexts[i],
          metadata: buildDealEmbeddingMetadata(row.deal),
          embedding: vectors[i],
        });
        totalEmbedded++;
      }
    }

    console.log(`  processed ${totalSeen} deals so far (embedded ${totalEmbedded}, skipped ${totalSkippedEmpty})`);
    offset += BATCH_SIZE;
  }

  console.log("\nDone.");
  console.log(`  deals seen:               ${totalSeen}`);
  console.log(`  embedded:                 ${totalEmbedded}`);
  console.log(`  skipped (empty content):  ${totalSkippedEmpty}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
