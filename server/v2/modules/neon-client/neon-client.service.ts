import {
  neonClientRepository,
  type NeonClientImport,
  type DuplicatePhoneGroupRow,
} from './neon-client.repository';
import { clientRepository } from '../client/client.repository';
import { AppError } from '../../utils/error-handler';
import type { NeonClient, InsertClientTable } from '@shared/schema';
import type { Scope } from '../../utils/scope';
import { stripOwnershipFields } from '../../utils/ownership-fields';
import { branchRepository } from '../branch/branch.repository';
import { fireAutoTriggerForClient } from '../sms/sms.service';
import { stripSystemManagedFields, assertValidReferrer } from './neon-client.guards';
import bcrypt from 'bcryptjs';

const PORTAL_PIN_BCRYPT_ROUNDS = 10;

export type PortalPinStatus = { hasPin: boolean; mustChangePin: boolean };

// A duplicate-group member, enriched with the numbers that tell the user which
// record to keep as the main client.
export type DuplicateGroupClient = NeonClient & {
  enquiryCount: number;
  quoteCount: number;
  bookingCount: number;
  lastActivityAt: Date | null;
};

export type MergeDuplicatesResult = {
  target: NeonClient;
  mergedIds: string[];
  failed: Array<{ id: string; error: string }>;
};

export const neonClientService = {
  async listNeonClientsPaginated(
    page: number,
    limit: number,
    search: string | undefined,
    scope: Scope,
  ): Promise<{ clients: NeonClient[]; total: number; page: number; limit: number; totalPages: number }> {
    const result = await neonClientRepository.findPaginated(page, limit, search, scope);
    return {
      ...result,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    };
  },

  async getNeonClientById(id: string, scope: Scope): Promise<NeonClient> {
    const client = await neonClientRepository.findById(id, scope);
    if (!client) throw new AppError('Client not found', 404);
    return client;
  },

  async createNeonClient(data: InsertClientTable, scope: Scope): Promise<NeonClient> {
    const clean = stripSystemManagedFields(data);
    await assertValidReferrer(null, clean.referredByClientId, scope);
    const safe = await stripOwnershipFields(clean, scope, async (b, o) => !!(await branchRepository.findById(b, o)));
    return neonClientRepository.create(safe as InsertClientTable, scope);
  },

  /** Candidate clients matching a contact's phone/email, for link suggestions. */
  async findMatches(opts: { phone?: string | null; email?: string | null }, scope: Scope): Promise<NeonClient[]> {
    return neonClientRepository.findMatches(opts, scope);
  },

  async findNameMatches(name: string | null | undefined, scope: Scope): Promise<NeonClient[]> {
    return neonClientRepository.findNameMatches(name, scope);
  },

  async updateNeonClient(id: string, data: Partial<InsertClientTable>, scope: Scope): Promise<NeonClient> {
    const clean = stripSystemManagedFields(data);
    if (clean.referredByClientId) {
      const current = await neonClientRepository.findById(id, scope);
      if (!current) throw new AppError('Client not found', 404);
      await assertValidReferrer(id, clean.referredByClientId, scope, current.referredByClientId);
    }
    const safe = await stripOwnershipFields(clean, scope, async (b, o) => !!(await branchRepository.findById(b, o)));
    const client = await neonClientRepository.update(id, safe, scope);
    if (!client) throw new AppError('Client not found', 404);
    return client;
  },

  /** Whether the client has a portal PIN. The hash itself is never exposed. */
  async getPortalPinStatus(id: string, scope: Scope): Promise<PortalPinStatus> {
    const client = await this.getNeonClientById(id, scope);
    return { hasPin: !!client.portalPin, mustChangePin: client.mustChangePin };
  },

  /** Staff-chosen PIN is final: stored hashed, forced-change flag cleared. */
  async setPortalPin(id: string, pin: string, scope: Scope): Promise<PortalPinStatus> {
    await this.getNeonClientById(id, scope);
    const hash = await bcrypt.hash(pin, PORTAL_PIN_BCRYPT_ROUNDS);
    await neonClientRepository.setPortalPin(id, hash);
    void fireAutoTriggerForClient({
      clientId: id,
      autoTrigger: 'on_pin_set',
      triggerSource: 'portal.staff.set-pin',
      dedupeSince: new Date(Date.now() - 5 * 60 * 1000),
    });
    return { hasPin: true, mustChangePin: false };
  },

  async removePortalPin(id: string, scope: Scope): Promise<void> {
    await this.getNeonClientById(id, scope);
    await neonClientRepository.setPortalPin(id, null);
  },

  async deleteNeonClient(id: string, scope: Scope): Promise<void> {
    const removed = await neonClientRepository.remove(id, scope);
    if (!removed) throw new AppError('Client not found', 404);
  },

  async bulkImportClients(clients: NeonClientImport[], scope: Scope) {
    if (!clients.length) throw new AppError('No clients to import', 400);

    // Rows are stripped of system-managed fields and their referrer is checked
    // against the caller's scope; a bad row becomes a row error rather than
    // failing the whole import. Row numbers stay 1-based against the upload.
    const accepted: NeonClientImport[] = [];
    const originalRow: number[] = [];
    const errors: Array<{ row: number; id: string; error: string }> = [];
    for (let i = 0; i < clients.length; i++) {
      const row = stripSystemManagedFields(clients[i]!);
      try {
        await assertValidReferrer(null, row.referredByClientId, scope);
        accepted.push(row);
        originalRow.push(i + 1);
      } catch (err) {
        errors.push({ row: i + 1, id: '-', error: err instanceof AppError ? err.message : 'Invalid row' });
      }
    }
    const result = accepted.length
      ? await neonClientRepository.bulkInsert(accepted, scope)
      : { imported: 0, errors: [] };
    for (const e of result.errors) errors.push({ ...e, row: originalRow[e.row - 1] ?? e.row });
    errors.sort((x, y) => x.row - y.row);
    return { imported: result.imported, errors };
  },

  /**
   * Merge a duplicate (source) client into a surviving (target) client. Reassigns
   * all of the source's records to the target and soft-archives the source. Both
   * clients must be within the caller's tenant scope.
   */
  async mergeClients(sourceId: string, targetId: string, scope: Scope): Promise<NeonClient> {
    if (sourceId === targetId) {
      throw new AppError('Cannot merge a client into itself', 400);
    }

    // Scope-enforced fetch: an out-of-scope client reads as 404.
    const [source, target] = await Promise.all([
      neonClientRepository.findById(sourceId, scope),
      neonClientRepository.findById(targetId, scope),
    ]);
    if (!source) throw new AppError('Source client not found', 404);
    if (!target) throw new AppError('Target client not found', 404);

    if (source.status === 'merged') {
      throw new AppError('Source client has already been merged', 400);
    }
    if (target.status === 'merged') {
      throw new AppError('Target client has already been merged into another client', 400);
    }
    if (source.orgId !== target.orgId) {
      throw new AppError('Clients must belong to the same organization', 400);
    }

    return clientRepository.mergeAtomic(source, target, scope.userId);
  },

  async listDuplicatePhoneGroups(
    page: number,
    limit: number,
    search: string | undefined,
    scope: Scope,
  ): Promise<{ groups: DuplicatePhoneGroupRow[]; total: number; page: number; limit: number; totalPages: number }> {
    const { groups, total } = await neonClientRepository.findDuplicatePhoneGroups(page, limit, search, scope);
    return {
      groups,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  /** The clients behind one duplicate-phone group, with deal counts to pick a survivor by. */
  async getDuplicatePhoneGroup(
    phoneKey: string,
    scope: Scope,
  ): Promise<{ phoneKey: string; clients: DuplicateGroupClient[] }> {
    const clients = await neonClientRepository.findByPhoneKey(phoneKey, scope);
    // Fewer than two means the group was already resolved (or never visible to
    // this caller) — there is nothing to merge, so it reads as gone.
    if (clients.length < 2) {
      throw new AppError('No duplicate clients found for this phone number', 404);
    }

    const counts = await neonClientRepository.countDealsByClientIds(clients.map((c) => c.id));
    const countsById = new Map(counts.map((c) => [c.clientId, c]));

    const enriched: DuplicateGroupClient[] = clients.map((client) => ({
      ...client,
      enquiryCount: countsById.get(client.id)?.enquiryCount ?? 0,
      quoteCount: countsById.get(client.id)?.quoteCount ?? 0,
      bookingCount: countsById.get(client.id)?.bookingCount ?? 0,
      lastActivityAt: countsById.get(client.id)?.lastActivityAt ?? null,
    }));

    // Most bookings first — a client who has actually travelled is the real
    // record, and keeping it as the survivor means the least history moves.
    // Quotes then enquiries break ties (progressively weaker signals of a live
    // relationship); an all-zero tie falls back to the oldest record, which is
    // the original the duplicates were created against.
    enriched.sort(
      (a, b) =>
        b.bookingCount - a.bookingCount ||
        b.quoteCount - a.quoteCount ||
        b.enquiryCount - a.enquiryCount ||
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    return { phoneKey, clients: enriched };
  },

  /**
   * Resolve a whole duplicate group in one call: merge every source into the
   * `targetId` the user picked as the main client. Each step goes through
   * mergeClients, so every guard and the atomic per-merge transaction still
   * apply.
   *
   * Merges run sequentially, not in parallel — each one back-fills the target's
   * blank profile fields and moves rows onto it, so they must observe each
   * other. A failure on one source doesn't abort the rest; it's collected and
   * returned so the UI can show exactly what's left unresolved.
   */
  async mergeDuplicatesInto(targetId: string, sourceIds: string[], scope: Scope): Promise<MergeDuplicatesResult> {
    const sources = Array.from(new Set(sourceIds)).filter((id) => id !== targetId);
    if (sources.length === 0) {
      throw new AppError('No duplicate clients to merge', 400);
    }

    const mergedIds: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    for (const sourceId of sources) {
      try {
        await this.mergeClients(sourceId, targetId, scope);
        mergedIds.push(sourceId);
      } catch (error) {
        failed.push({ id: sourceId, error: error instanceof Error ? error.message : 'Merge failed' });
      }
    }

    // Nothing moved at all is a failed request, not a partial success — surface
    // the underlying reason rather than a misleading 200.
    if (mergedIds.length === 0) {
      throw new AppError(failed[0]?.error ?? 'Merge failed', 400);
    }

    // Re-read: the merges back-filled the target's profile fields.
    const target = await this.getNeonClientById(targetId, scope);
    return { target, mergedIds, failed };
  },
};
