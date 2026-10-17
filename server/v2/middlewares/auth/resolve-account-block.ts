import { branchMemberRepository } from '../../modules/branch-member/branch-member.repository';
import { accountBlock, type AccountBlock, type AccountStandingUser } from './account-standing';

/**
 * Async wrapper around accountBlock. The membership standing is queried only
 * when it can matter: not banned, not a platform admin, not a pending invite and
 * the caller found no active membership already.
 */
export async function resolveAccountBlock(
  user: AccountStandingUser & { id: string },
  hasActiveMembership: boolean,
): Promise<AccountBlock | null> {
  const early = accountBlock(user, null);
  if (early) return early;
  if (hasActiveMembership || user.role === 'platform_admin' || user.inviteToken != null) return null;
  return accountBlock(user, await branchMemberRepository.findStandingByUserId(user.id));
}
