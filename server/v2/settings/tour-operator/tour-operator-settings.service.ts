import { tourOperatorSettingsRepository } from './tour-operator-settings.repository';
import { AppError } from '../../../utils/error-handler';
import type { Scope } from '../../utils/scope';
import { deleteImageByStoredUrl, uploadImageToS3 } from '../../utils/image-storage';

const LOGO_S3_PREFIX = 'tour-operator-logos';

export const tourOperatorSettingsService = {
  async findAll(query: Record<string, any>, scope: Scope) {
    return tourOperatorSettingsRepository.findAll(query, scope);
  },

  async findById(id: string, scope: Scope) {
    const row = await tourOperatorSettingsRepository.findById(id, scope);
    if (!row) throw new AppError('Tour operator not found', 404);
    return row;
  },

  async create(data: any, scope: Scope) {
    return tourOperatorSettingsRepository.create(data, scope);
  },

  async update(id: string, data: any, scope: Scope) {
    const row = await tourOperatorSettingsRepository.update(id, data, scope);
    if (!row) throw new AppError('Tour operator not found', 404);
    return row;
  },

  async remove(id: string, scope: Scope) {
    const row = await tourOperatorSettingsRepository.findById(id, scope);
    if (row?.logo_url) {
      try {
        await deleteImageByStoredUrl(row.logo_url);
      } catch (err) {
        console.error(`Failed to delete tour operator logo for ${id}`, err);
      }
    }
    await tourOperatorSettingsRepository.remove(id, scope);
  },

  async uploadLogo(id: string, file: Express.Multer.File, scope: Scope) {
    const row = await tourOperatorSettingsRepository.findById(id, scope);
    if (!row) throw new AppError('Tour operator not found', 404);

    if (row.logo_url) {
      try {
        await deleteImageByStoredUrl(row.logo_url);
      } catch (err) {
        console.error(`Failed to delete previous tour operator logo for ${id}`, err);
      }
    }

    const logo_url = await uploadImageToS3(file, LOGO_S3_PREFIX);
    const updated = await tourOperatorSettingsRepository.update(id, { logo_url }, scope);
    if (!updated) throw new AppError('Tour operator not found', 404);
    return updated;
  },

  async deleteLogo(id: string, scope: Scope) {
    const row = await tourOperatorSettingsRepository.findById(id, scope);
    if (!row) throw new AppError('Tour operator not found', 404);

    if (row.logo_url) {
      try {
        await deleteImageByStoredUrl(row.logo_url);
      } catch (err) {
        console.error(`Failed to delete tour operator logo for ${id}`, err);
      }
    }

    const updated = await tourOperatorSettingsRepository.update(id, { logo_url: null }, scope);
    if (!updated) throw new AppError('Tour operator not found', 404);
    return updated;
  },
};
