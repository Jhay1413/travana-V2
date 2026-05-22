import { AppError } from "../../utils/error-handler";
import { planRepository } from "./plan.repository";
import { branchRepository } from "../branch/branch.repository";
import type { Plan } from "@shared/schema";

const FALLBACK_PLAN_CODE = "starter";

export const planService = {
  async list(): Promise<Plan[]> {
    return planRepository.findAll();
  },

  async getOrgPlan(orgId: string): Promise<Plan> {
    const plan = await planRepository.findByOrg(orgId);
    if (plan) return plan;

    const fallback = await planRepository.findByCode(FALLBACK_PLAN_CODE);
    if (!fallback) {
      throw new AppError(
        `No plan resolved for organization and fallback "${FALLBACK_PLAN_CODE}" is missing. Run scripts/seed-plans.ts.`,
        500,
      );
    }
    return fallback;
  },

  async assertCanAddBranch(orgId: string): Promise<void> {
    const plan = await this.getOrgPlan(orgId);
    if (plan.branchLimit === null) return;

    const count = await branchRepository.countByOrg(orgId);
    if (count >= plan.branchLimit) {
      throw new AppError(
        `Plan "${plan.code}" allows ${plan.branchLimit} branch(es). Upgrade to add more.`,
        403,
      );
    }
  },
};
