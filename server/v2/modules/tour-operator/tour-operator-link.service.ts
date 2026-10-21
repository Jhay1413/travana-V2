import { OPERATOR_MESSAGES } from '@shared/tour-operator-rules';
import { AppError } from '../../utils/error-handler';
import { orgTourOperatorRepository } from './org-tour-operator.repository';
import { collectTourOperatorIds } from './collect-operator-ids';
import type { ScopeOrTrusted } from './tour-operator.types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function assertOperatorsLinked(scope: ScopeOrTrusted, ids: string[], alreadyOnRecord: string[] = []): Promise<void> {
  if (!scope.orgId) return;
  const known = new Set(alreadyOnRecord.map((id) => id.toLowerCase()));
  const toCheck = Array.from(new Set(ids.map((id) => id.toLowerCase()))).filter((id) => !known.has(id));
  if (toCheck.length === 0) return;
  if (toCheck.some((id) => !UUID_RE.test(id))) throw new AppError(OPERATOR_MESSAGES.notInList, 400);

  const linked = new Set((await orgTourOperatorRepository.findLinkedOperatorIds(scope.orgId, toCheck)).map((id) => id.toLowerCase()));
  if (toCheck.some((id) => !linked.has(id))) throw new AppError(OPERATOR_MESSAGES.notInList, 400);
}

/**
 * Picks the agency's own operator for a scraped name: exact (case-insensitive)
 * match first, otherwise a "contains" match that is accepted ONLY when exactly
 * one linked operator matches. Pure.
 */
export function matchLinkedOperator<T extends { name: string }>(operators: T[], name: string): T | null {
  const key = name.trim().toLowerCase();
  if (!key) return null;
  const exact = operators.find((o) => o.name.trim().toLowerCase() === key);
  if (exact) return exact;
  const contains = operators.filter((o) => o.name.toLowerCase().includes(key));
  return contains.length === 1 ? contains[0] : null;
}

export const tourOperatorLinkService = {
  /**
   * Quote/booking/upsell/transaction writes may only use operators the caller's
   * organisation has linked (active or inactive). Ids already stored on the
   * record (`alreadyOnRecord`) are skipped so editing an old record never
   * fails over an operator the agency has since removed. A scope with no orgId
   * is a trusted internal call and is not checked.
   */
  assertOperatorsLinked,

  /**
   * Checks every operator id found in a quote/booking payload. `loadExisting`
   * (ids already stored on the record) is only called when the payload has
   * operators and the caller has an org; those ids are exempt.
   */
  async assertPayloadOperatorsLinked(
    scope: ScopeOrTrusted,
    payload: unknown,
    loadExisting: () => Promise<string[]>,
  ): Promise<void> {
    const ids = collectTourOperatorIds(payload);
    if (ids.length === 0 || !scope.orgId) return;
    await assertOperatorsLinked(scope, ids, await loadExisting());
  },

  /** True when the org has this operator linked (active or not). */
  async isOperatorLinked(orgId: string, operatorId: string): Promise<boolean> {
    return (await orgTourOperatorRepository.findLinkedOperatorIds(orgId, [operatorId])).length > 0;
  },

  /** The agency's own linked operator (active or not) that a scraped name refers to, or null. */
  async findLinkedOperatorByName(orgId: string, name: string): Promise<{ id: string; name: string } | null> {
    const linked = await orgTourOperatorRepository.listForOrg(orgId, true);
    const hit = matchLinkedOperator(linked.map((l) => ({ id: l.operatorId, name: l.name })), name);
    return hit;
  },

  /** Makes sure the org has a link to the operator (commission NULL when created). */
  async ensureLinkForOrg(
    orgId: string,
    operatorId: string,
    userId: string | null,
    commissionPercentage: string | null = null,
  ): Promise<{ created: boolean; linkId: string }> {
    return orgTourOperatorRepository.ensureLink(orgId, operatorId, userId, commissionPercentage);
  },
};
