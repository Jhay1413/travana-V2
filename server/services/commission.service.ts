import { commissionRepository } from "../repositories/commission.repository";
import { AppError } from "../utils/error-handler";
import type { Commission, InsertCommission } from "../types/commission";

export const commissionService = {
  async getByQuoteId(quoteId: string): Promise<Commission> {
    const commission = await commissionRepository.findByQuoteId(quoteId);
    if (!commission) {
      throw new AppError("Commission not found", 404);
    }
    return commission;
  },

  async createCommission(data: InsertCommission): Promise<Commission> {
    const commission = await commissionRepository.create(data);
    return commission;
  },

  async updateCommission(id: string, data: Partial<InsertCommission>): Promise<Commission> {
    const commission = await commissionRepository.update(id, data);
    if (!commission) {
      throw new AppError("Commission not found", 404);
    }
    return commission;
  },
};
