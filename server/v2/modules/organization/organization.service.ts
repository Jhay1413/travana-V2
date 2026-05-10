import { AppError } from '../../utils/error-handler';
import { organizationRepository } from './organization.repository';
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

  async create(data: any) {
    return organizationRepository.create(data);
  },

  async update(id: string, data: OrgUpdate) {
    if (data.slug) {
      const existing = await organizationRepository.findBySlug(data.slug);
      if (existing && existing.id !== id) {
        throw new AppError('That agency URL is already taken', 409);
      }
    }

    if (data.settings !== undefined) {
      const current = await organizationRepository.findById(id);
      if (!current) throw new AppError('Organization not found', 404);
      data = {
        ...data,
        settings: { ...(current.settings as Record<string, unknown> ?? {}), ...(data.settings as Record<string, unknown>) },
      };
    }

    const org = await organizationRepository.update(id, data);
    if (!org) throw new AppError('Organization not found', 404);
    return org;
  },

  async remove(id: string) {
    await organizationRepository.remove(id);
  },
};
