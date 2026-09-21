/**
 * Backfill latitude/longitude for destination_guru rows created before
 * coordinates existed (or where the AI's own "coordinates" field and the
 * generation-time geocode fallback both failed).
 *
 * Only touches rows with NULL latitude — never overwrites 'ai' or 'manual'
 * coordinates, so it's safe to re-run.
 *
 *   npx tsx --env-file-if-exists=.env scripts/backfill-destination-guru-coordinates.ts --dry-run
 *   npm run db:backfill-guru-coordinates
 */
import { destinationGuruRepository } from "../server/v2/modules/destination-guru/destination-guru.repository";
import { geocodeDestination } from "../server/v2/modules/destination-guru/destination-guru.service";

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  console.log(`Backfilling destination_guru coordinates${dryRun ? " (dry run)" : ""}...`);

  const rows = await destinationGuruRepository.findWithoutCoordinates();
  console.log(`  found ${rows.length} row(s) without coordinates`);

  let totalGeocoded = 0;
  let totalFailed = 0;

  if (dryRun) {
    console.log("\ndestination | country | lat | lng");
    console.log("------------|---------|-----|----");
  }

  for (const row of rows) {
    try {
      const coords = await geocodeDestination(row.destination, row.country);
      if (!coords) {
        totalFailed++;
        console.log(`  [skip] ${row.destination}, ${row.country} — geocode failed`);
        continue;
      }

      if (dryRun) {
        console.log(`${row.destination} | ${row.country} | ${coords.lat} | ${coords.lng}`);
      } else {
        await destinationGuruRepository.updateCoordinates(row.id, {
          latitude: coords.lat,
          longitude: coords.lng,
          coordinatesSource: "backfill",
        });
      }
      totalGeocoded++;
    } catch (err) {
      totalFailed++;
      console.error(`  [error] ${row.destination}, ${row.country}:`, err);
    }
  }

  console.log("\nDone.");
  console.log(`  rows seen:      ${rows.length}`);
  console.log(`  geocoded:       ${totalGeocoded}${dryRun ? " (not written — dry run)" : ""}`);
  console.log(`  failed/skipped: ${totalFailed}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
