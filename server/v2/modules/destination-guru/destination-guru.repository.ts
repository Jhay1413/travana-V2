import { db } from '../../config/database';
import { destinationGuruTable, type InsertDestinationGuru } from '@shared/schema';
import { eq, ilike, isNull, or, sql } from 'drizzle-orm';

interface UpdateCoordinatesInput {
  latitude: number;
  longitude: number;
  coordinatesSource: 'ai' | 'backfill' | 'manual';
}

export const destinationGuruRepository = {
  async findAll() {
    return db.select().from(destinationGuruTable).orderBy(destinationGuruTable.destination);
  },

  async findById(id: string) {
    const [row] = await db.select().from(destinationGuruTable).where(eq(destinationGuruTable.id, id)).limit(1);
    return row || undefined;
  },

  async findByDestination(destination: string) {
    const [row] = await db
      .select()
      .from(destinationGuruTable)
      .where(
        or(
          ilike(destinationGuruTable.destination, destination),
          sql`${destination} ILIKE '%' || ${destinationGuruTable.destination} || '%'`,
        ),
      )
      .limit(1);
    return row || undefined;
  },

  async create(data: InsertDestinationGuru) {
    const [row] = await db.insert(destinationGuruTable).values(data).returning();
    return row;
  },

  async updateCoordinates(id: string, { latitude, longitude, coordinatesSource }: UpdateCoordinatesInput) {
    const [row] = await db
      .update(destinationGuruTable)
      .set({ latitude, longitude, coordinatesSource, updatedAt: new Date() })
      .where(eq(destinationGuruTable.id, id))
      .returning();
    return row || null;
  },

  // Records a geocode attempt that came back empty — keeps latitude/longitude
  // NULL (satisfies the destination_guru_coords_pair check) while marking
  // coordinatesSource 'failed' so callers can tell "never tried" (NULL) apart
  // from "tried and got nothing" and avoid re-billing an OpenAI call on every
  // subsequent fuzzy-matched request. findWithoutCoordinates() still surfaces
  // these rows (latitude IS NULL) for a manual backfill re-run.
  async markGeocodeFailed(id: string) {
    const [row] = await db
      .update(destinationGuruTable)
      .set({ latitude: null, longitude: null, coordinatesSource: 'failed', updatedAt: new Date() })
      .where(eq(destinationGuruTable.id, id))
      .returning();
    return row || null;
  },

  async findWithoutCoordinates() {
    return db
      .select()
      .from(destinationGuruTable)
      .where(isNull(destinationGuruTable.latitude))
      .orderBy(destinationGuruTable.destination);
  },

  async remove(id: string) {
    await db.delete(destinationGuruTable).where(eq(destinationGuruTable.id, id));
  },
};
