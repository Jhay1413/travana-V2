import { NO_DECISION, PORTAL_DECLINE_REASONS, type PortalQuoteAction, type PortalQuoteDecision, type PortalQuoteDecisionState } from '@shared/portal-quotes';
import { AppError } from '../../utils/error-handler';
import { quotePublicRepository } from '../quote/quote-public.repository';
import { quotePublicService, type CustomerActionType } from '../quote/quote-public.service';
import { portalRepository } from './portal.repository';
import { portalQuotesRepository } from './portal-quotes.repository';
import { buildDetail, buildListItem, decisionFor, latestDecisions, summariseImages } from './portal-quotes.mapper';
import type { PortalQuoteAccessRow, PortalQuoteDetail, PortalQuoteListItem, PortalQuoteOwnership } from './portal-quotes.types';

/** The stored action type for each thing the customer can do. "I'm interested" is the existing "accepted". */
export const ACTION_TYPE: Record<PortalQuoteAction, CustomerActionType> = {
  interested: 'accepted',
  declined: 'declined',
  reopened: 'reopened',
};

/** The decision each action leaves the quote in. */
const RESULTING_STATE: Record<PortalQuoteAction, PortalQuoteDecisionState> = {
  interested: 'interested',
  declined: 'declined',
  reopened: 'none',
};

const NOT_FOUND = 'Quote not found';

/** The customer's own quote whose deal is now a booking: the link answers this (the page shows a themed message), not a bare not-found. */
export const BOOKED_CODE = 'BOOKED';
const bookedError = (bookingId?: string) =>
  new AppError('This holiday is booked', 410, true, BOOKED_CODE, bookingId ? { bookingId } : undefined);

/** The booked answer for the quote's OWNER: carries the booking's id when the deal has exactly one live booking (else none, and the page links to the list). */
async function bookedErrorFor(quoteId: string): Promise<AppError> {
  const ids = await portalQuotesRepository.findLiveBookingIdsForQuote(quoteId);
  return bookedError(ids.length === 1 ? ids[0] : undefined);
}

/** Identical requests running at this moment (two taps at once): the second waits for the first's answer. */
const inFlight = new Map<string, Promise<{ decision: PortalQuoteDecision }>>();

export interface PortalQuoteActionInput {
  action: PortalQuoteAction;
  note?: string | null;
  reason?: string | null;
  wantsSimilar?: boolean;
}

export interface ReadableQuote {
  access: PortalQuoteAccessRow;
  /** The signed-in customer owns the quote (as opposed to reading a published deal of their agency). */
  owns: boolean;
}

export const portalQuotesService = {
  /** The customer's own quotes with price, photos and their latest decision on each. */
  async listQuotes(clientId: string): Promise<PortalQuoteListItem[]> {
    const rows = await portalQuotesRepository.findClientQuotes(clientId);
    const ids = rows.map((r) => r.quoteId);
    const [images, actions] = await Promise.all([
      portalRepository.findImagesForQuotes(ids),
      portalQuotesRepository.findDecisionActions(ids),
    ]);
    const imageSummary = summariseImages(images);
    const decisions = latestDecisions(actions);

    return Promise.all(
      rows.map(async (r) => {
        const token = r.quoteToken || (await quotePublicRepository.setToken(r.quoteId));
        const img = imageSummary.get(r.quoteId);
        return buildListItem(r, {
          token,
          imageUrl: img?.url ?? '',
          photoCount: img?.count ?? 0,
          decision: decisionFor(decisions, r.quoteId),
        });
      }),
    );
  },

  /**
   * The quote behind a token if this customer may read it: it is visible to customers at all, and it is either
   * theirs or a published deal of THEIR OWN agency (the deals-list predicate, evaluated for the customer's
   * organisation; a customer with no organisation reads no deals). Anything else is a 404, the same answer as
   * for a token that does not exist.
   */
  async getReadable(clientId: string, token: string): Promise<ReadableQuote> {
    const org = await portalRepository.findClientOrg(clientId);
    const access = await portalQuotesRepository.findAccessByToken(token, org?.orgId ?? null);
    if (!access) throw new AppError(NOT_FOUND, 404);
    const owns = access.ownerClientId === clientId;
    if (!owns && !access.isPublishedDeal) throw new AppError(NOT_FOUND, 404);
    if (owns && access.isBooked) throw await bookedErrorFor(access.quoteId);
    return { access, owns };
  },

  /** One quote in full (see getReadable for who may read it). */
  async getQuote(clientId: string, token: string): Promise<PortalQuoteDetail> {
    const { access, owns } = await this.getReadable(clientId, token);
    const data = await quotePublicRepository.findByToken(token);
    if (!data) throw new AppError(NOT_FOUND, 404);

    // The decision belongs to the customer's own quote; a published deal has none to show.
    const decision = owns
      ? decisionFor(latestDecisions(await portalQuotesRepository.findDecisionActions([access.quoteId])), access.quoteId)
      : { ...NO_DECISION };
    // Sharing hands out the public page, which names the quote's client: only for the customer's own quote or a
    // deal with no real customer on it.
    const canShare = owns || access.ownerClientId === null;
    return buildDetail(data, access, token, { canDecide: owns, canShare, decision });
  },

  /** Ownership answer the quote page and the shared-link page use; `isPublicDeal` is the same-agency published-deal rule. */
  async checkOwnership(clientId: string, token: string): Promise<PortalQuoteOwnership> {
    const org = await portalRepository.findClientOrg(clientId);
    const access = await portalQuotesRepository.findAccessByToken(token, org?.orgId ?? null);
    if (!access) return { found: false, owns: false, isPublicDeal: false };
    return { found: true, owns: access.ownerClientId === clientId, isPublicDeal: access.isPublishedDeal };
  },

  /**
   * "I'm interested", "Not interested" and its undo. The customer is the signed-in one (never named by the
   * request), the quote must be theirs, and the record and the agent's notification are the ones staff
   * already see for the public page (quotePublicService.handleCustomerAction).
   *
   * Idempotent by state: if the quote's latest decision is already what the action leaves it in, nothing is
   * written or notified and that decision is returned, however long ago it was made. A different action always
   * writes (so decline, undo, decline is three records).
   */
  async recordAction(clientId: string, token: string, input: PortalQuoteActionInput): Promise<{ decision: PortalQuoteDecision }> {
    const org = await portalRepository.findClientOrg(clientId);
    const access = await portalQuotesRepository.findAccessByToken(token, org?.orgId ?? null);
    if (!access || access.ownerClientId !== clientId) throw new AppError(NOT_FOUND, 404);
    if (access.isBooked) throw await bookedErrorFor(access.quoteId);

    const reason = input.action === 'declined' ? input.reason?.trim() || null : null;
    if (reason !== null && !(PORTAL_DECLINE_REASONS as readonly string[]).includes(reason)) {
      throw new AppError('Please choose one of the listed reasons', 400);
    }

    // Two identical requests at the same moment: the second takes the first's answer.
    const key = `${access.quoteId}:${input.action}`;
    const running = inFlight.get(key);
    if (running) return running;
    const work = this.writeAction(clientId, token, access.quoteId, input, reason);
    inFlight.set(key, work);
    try {
      return await work;
    } finally {
      inFlight.delete(key);
    }
  },

  async writeAction(
    clientId: string,
    token: string,
    quoteId: string,
    input: PortalQuoteActionInput,
    reason: string | null,
  ): Promise<{ decision: PortalQuoteDecision }> {
    const actions = await portalQuotesRepository.findDecisionActions([quoteId]);
    const current = decisionFor(latestDecisions(actions), quoteId);

    // Already in the state this action leaves it in, or an undo of something that is not declined: nothing to do.
    if (current.state === RESULTING_STATE[input.action]) return { decision: current };
    if (input.action === 'reopened' && current.state !== 'declined') return { decision: current };

    const note = input.note?.trim() || null;
    const actionType = ACTION_TYPE[input.action];
    const client = await portalRepository.findClientNameById(clientId);
    const customerName = [client?.firstName, client?.lastName].filter(Boolean).join(' ') || null;
    const created = await quotePublicService.handleCustomerAction(
      token,
      actionType,
      note,
      customerName,
      input.action === 'declined' ? { reason, wantsSimilar: input.wantsSimilar ?? false } : undefined,
    );
    const decision = decisionFor(
      latestDecisions([
        {
          quoteId,
          actionType: created.actionType,
          message: created.message,
          reason: created.reason,
          wantsSimilar: created.wantsSimilar,
          createdAt: created.createdAt,
        },
      ]),
      quoteId,
    );
    return { decision };
  },
};
