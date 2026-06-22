import { neonClientRepository } from '../neon-client/neon-client.repository';
import { referralRepository } from './referral.repository';

function computeTier(totalReferrals: number): 'standard' | 'gold' | 'elite' {
  if (totalReferrals >= 5) return 'elite';
  if (totalReferrals >= 3) return 'gold';
  return 'standard';
}

export const vipEnrollmentService = {
  async enrollClient(clientId: string): Promise<void> {
    const client = await neonClientRepository.findVipEnrolledAt(clientId);
    if (!client || client.vipEnrolledAt) return;
    await neonClientRepository.enrollVip(clientId);
  },

  async recalculateTier(referrerClientId: string): Promise<void> {
    const count = await referralRepository.countSuccessfulByReferrer(referrerClientId);
    const newTier = computeTier(count);
    await neonClientRepository.setVipTotalsAndTier(referrerClientId, count, newTier);
  },
};
