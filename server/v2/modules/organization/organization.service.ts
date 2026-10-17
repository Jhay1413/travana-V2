import { AppError } from '../../utils/error-handler';
import { organizationRepository } from './organization.repository';
import { planRepository } from '../plan/plan.repository';
import type { InsertOrganization } from '@shared/schema';

type OrgUpdate = Partial<InsertOrganization>;

export const organizationService = {
  async list() {
    return organizationRepository.findAll();
  },

  async getById(id: string) {
    const org = await organizationRepository.findById(id);
    if (!org) throw new AppError('Organization not found', 404);
    return org;
  },

  async create(data: InsertOrganization) {
    return organizationRepository.create(data);
  },

  async update(id: string, data: OrgUpdate) {
    if (data.slug) {
      const existing = await organizationRepository.findBySlug(data.slug);
      if (existing && existing.id !== id) {
        throw new AppError('That agency URL is already taken', 409);
      }
    }

    // data.settings is passed as a patch; the repository merges it atomically in SQL.
    // `onboarding` is server-owned (written only via mergeSettingsSection); a stale copy from a
    // client's cached settings must never overwrite it.
    if (data.settings && typeof data.settings === 'object') {
      const { onboarding: _ignored, ...rest } = data.settings as Record<string, unknown>;
      data = { ...data, settings: rest };
    }

    // The plan decides the seat allowance: a plan change copies plans.seatLimit onto the org
    // (null = unlimited). An explicit seatLimit (platform admin) is kept as given.
    if (data.plan && data.seatLimit === undefined) {
      const plan = await planRepository.findByCode(data.plan);
      if (plan) data = { ...data, seatLimit: plan.seatLimit };
    }

    const org = await organizationRepository.update(id, data);
    if (!org) throw new AppError('Organization not found', 404);
    return org;
  },

  async remove(id: string) {
    await organizationRepository.remove(id);
  },
};
