import { neonClientRepository } from './neon-client.repository';
import { AppError } from '../../utils/error-handler';
import type { Scope } from '../../utils/scope';
import { SYSTEM_MANAGED_CLIENT_FIELDS } from './neon-client.validator';

// Defence in depth behind the validators: system-managed columns (portal PIN,
// merge/split lineage, VIP state, status) never reach a repository from a
// request body, whatever route the data came in on.
export function stripSystemManagedFields<T extends object>(data: T): T {
  const copy = { ...data } as Record<string, unknown>;
  for (const key of Object.keys(SYSTEM_MANAGED_CLIENT_FIELDS)) delete copy[key];
  return copy as T;
}

/**
 * A referrer must be an active client the caller can see (scope includes the
 * branch for branch managers), and never the client itself. Skipped when it is
 * unchanged from the stored value so editing other fields never re-validates a
 * legacy referrer.
 */
export async function assertValidReferrer(
  clientId: string | null,
  referrerId: string | null | undefined,
  scope: Scope,
  currentReferrerId?: string | null,
): Promise<void> {
  if (!referrerId) return;
  if (currentReferrerId !== undefined && referrerId === currentReferrerId) return;
  if (clientId && referrerId === clientId) throw new AppError('A client cannot refer themselves', 400);
  const referrer = await neonClientRepository.findById(referrerId, scope);
  if (!referrer || referrer.status !== 'active') throw new AppError('Referring client not found', 400);
}
