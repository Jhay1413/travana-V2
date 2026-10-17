import { AppError } from '../../utils/error-handler';
import { organizationSeatRepository } from './organization-seat.repository';
import type { SeatUsage } from './organization.types';

export const organizationSeatService = {
  async getUsage(orgId: string): Promise<SeatUsage> {
    const { limit, activeMembers, pendingInvites } = await organizationSeatRepository.countUsage(orgId);
    const used = activeMembers + pendingInvites;
    return {
      limit,
      activeMembers,
      pendingInvites,
      used,
      available: limit === null ? null : Math.max(limit - used, 0),
    };
  },

  /** 409 when active members + pending invites already fill the plan. No role is exempt. */
  async assertSeatAvailable(orgId: string): Promise<void> {
    const usage = await this.getUsage(orgId);
    if (usage.limit !== null && usage.used >= usage.limit) {
      throw new AppError(`All ${usage.limit} seats are in use`, 409);
    }
  },
};
