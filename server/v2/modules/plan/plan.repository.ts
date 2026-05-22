import { db } from "../../config/database";
import { plans, organization, type Plan } from "@shared/schema";
import { asc, eq } from "drizzle-orm";

export const planRepository = {
  async findAll(): Promise<Plan[]> {
    return db.select().from(plans).orderBy(asc(plans.priceCents));
  },

  async findByCode(code: string): Promise<Plan | null> {
    const [row] = await db.select().from(plans).where(eq(plans.code, code)).limit(1);
    return row ?? null;
  },

  async findByOrg(orgId: string): Promise<Plan | null> {
    const [row] = await db
      .select({
        id: plans.id,
        code: plans.code,
        name: plans.name,
        branchLimit: plans.branchLimit,
        seatLimit: plans.seatLimit,
        priceCents: plans.priceCents,
        features: plans.features,
        createdAt: plans.createdAt,
      })
      .from(organization)
      .innerJoin(plans, eq(plans.code, organization.plan))
      .where(eq(organization.id, orgId))
      .limit(1);
    return row ?? null;
  },
};
