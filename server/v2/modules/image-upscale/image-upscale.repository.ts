import { db } from "../../config/database";
import { imageUpscaleJob } from "@shared/schema";
import type { ImageUpscaleJob, InsertImageUpscaleJob } from "@shared/schema";
import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";

const ACTIVE_STATUSES = ["queued", "processing"] as const;
const PG_UNIQUE_VIOLATION = "23505";

export type ImageUpscaleJobUpdate = Partial<Omit<InsertImageUpscaleJob, "id" | "orgId" | "createdAt">>;

/** True for a Postgres unique-violation, whether the driver error is wrapped (`cause`) or not. */
export function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const withCode = err as { code?: unknown; cause?: unknown };
  if (withCode.code === PG_UNIQUE_VIOLATION) return true;
  return isUniqueViolation(withCode.cause);
}

export const imageUpscaleRepository = {
  /**
   * Inserts the job unless the org already has `cap` in-flight jobs; null means
   * the cap was hit. The count and the insert run in one transaction behind a
   * per-org advisory lock, so concurrent requests cannot both slip under the cap.
   * Throws the driver's unique violation when an active job for the same quote
   * image exists (see `isUniqueViolation`).
   */
  async insertIfUnderCap(data: InsertImageUpscaleJob, cap: number): Promise<ImageUpscaleJob | null> {
    return db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`image-upscale:${data.orgId}`}))`);
      const [{ active }] = await tx
        .select({ active: count() })
        .from(imageUpscaleJob)
        .where(and(eq(imageUpscaleJob.orgId, data.orgId), inArray(imageUpscaleJob.status, [...ACTIVE_STATUSES])));
      if (active >= cap) return null;
      const [row] = await tx.insert(imageUpscaleJob).values(data).returning();
      return row;
    });
  },

  async update(id: string, data: ImageUpscaleJobUpdate): Promise<ImageUpscaleJob | null> {
    const [row] = await db.update(imageUpscaleJob).set(data).where(eq(imageUpscaleJob.id, id)).returning();
    return row ?? null;
  },

  /** Atomically takes a queued job (queued -> processing); null when someone else already did. */
  async claimQueued(id: string): Promise<ImageUpscaleJob | null> {
    const [row] = await db
      .update(imageUpscaleJob)
      .set({ status: "processing", startedAt: new Date() })
      .where(and(eq(imageUpscaleJob.id, id), eq(imageUpscaleJob.status, "queued")))
      .returning();
    return row ?? null;
  },

  /** Always tenant-scoped. */
  async findById(id: string, orgId: string): Promise<ImageUpscaleJob | null> {
    const [row] = await db
      .select()
      .from(imageUpscaleJob)
      .where(and(eq(imageUpscaleJob.id, id), eq(imageUpscaleJob.orgId, orgId)))
      .limit(1);
    return row ?? null;
  },

  /** Worker only: it acts on rows it already owns, with no request scope. */
  async findByIdUnscoped(id: string): Promise<ImageUpscaleJob | null> {
    const [row] = await db.select().from(imageUpscaleJob).where(eq(imageUpscaleJob.id, id)).limit(1);
    return row ?? null;
  },

  async listByQuote(quoteId: string, orgId: string): Promise<ImageUpscaleJob[]> {
    return db
      .select()
      .from(imageUpscaleJob)
      .where(and(eq(imageUpscaleJob.quoteId, quoteId), eq(imageUpscaleJob.orgId, orgId)))
      .orderBy(desc(imageUpscaleJob.createdAt));
  },

  async listRecentForUser(userId: string, orgId: string, limit: number): Promise<ImageUpscaleJob[]> {
    return db
      .select()
      .from(imageUpscaleJob)
      .where(and(eq(imageUpscaleJob.createdBy, userId), eq(imageUpscaleJob.orgId, orgId)))
      .orderBy(desc(imageUpscaleJob.createdAt))
      .limit(limit);
  },

  /** An in-flight job for the same quote image (avoids upscaling one image twice). */
  async findActiveDuplicate(quoteId: string, originalUrl: string, orgId: string): Promise<ImageUpscaleJob | null> {
    const [row] = await db
      .select()
      .from(imageUpscaleJob)
      .where(
        and(
          eq(imageUpscaleJob.orgId, orgId),
          eq(imageUpscaleJob.quoteId, quoteId),
          eq(imageUpscaleJob.originalUrl, originalUrl),
          inArray(imageUpscaleJob.status, [...ACTIVE_STATUSES]),
        ),
      )
      .orderBy(desc(imageUpscaleJob.createdAt))
      .limit(1);
    return row ?? null;
  },

  async listQueued(): Promise<ImageUpscaleJob[]> {
    return db.select().from(imageUpscaleJob).where(eq(imageUpscaleJob.status, "queued"));
  },

  /** Boot recovery: jobs the previous process was running can never finish. */
  async markProcessingAsFailed(reason: string): Promise<ImageUpscaleJob[]> {
    return db
      .update(imageUpscaleJob)
      .set({ status: "failed", error: reason, finishedAt: new Date() })
      .where(and(eq(imageUpscaleJob.status, "processing"), isNull(imageUpscaleJob.finishedAt)))
      .returning();
  },
};
