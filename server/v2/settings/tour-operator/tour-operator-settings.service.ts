import type { InsertTourOperatorLookup, TourOperatorLookup } from '@shared/schema';
import { AppError } from '../../utils/error-handler';
import { isUniqueViolation } from '../../utils/pg-errors';
import { deleteImageByStoredUrl, uploadImageToS3 } from '../../utils/image-storage';
import { tourOperatorSettingsRepository, type CataloguePage } from './tour-operator-settings.repository';
import type { CatalogueCreateBody, CatalogueListQuery, CatalogueUpdateBody } from './tour-operator-settings.validator';

const LOGO_S3_PREFIX = 'tour-operator-logos';
const NOT_FOUND = 'Tour operator not found';

/** "" clears an optional text column. */
function nullIfBlank(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  return value === '' ? null : value;
}

async function removeStoredLogo(operator: TourOperatorLookup, what: string): Promise<void> {
  if (!operator.logo_url) return;
  try {
    await deleteImageByStoredUrl(operator.logo_url);
  } catch (err) {
    console.error(`Failed to delete ${what} for tour operator ${operator.id}`, err);
  }
}

async function requireOperator(id: string): Promise<TourOperatorLookup> {
  const row = await tourOperatorSettingsRepository.findById(id);
  if (!row) throw new AppError(NOT_FOUND, 404);
  return row;
}

/**
 * The platform tour-operator catalogue. The router is platform-admin only, so
 * there is no organisation scoping here: these rows belong to every agency.
 */
export const tourOperatorSettingsService = {
  async findAll(query: CatalogueListQuery): Promise<CataloguePage> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
    return tourOperatorSettingsRepository.findAll(page, limit, query.search ?? '');
  },

  async findById(id: string): Promise<TourOperatorLookup> {
    return requireOperator(id);
  },

  async create(body: CatalogueCreateBody, userId: string | null): Promise<TourOperatorLookup> {
    if (await tourOperatorSettingsRepository.findByLowerName(body.name)) {
      throw new AppError(`${body.name} is already in the catalogue`, 409);
    }
    const values: InsertTourOperatorLookup = {
      name: body.name,
      code: nullIfBlank(body.code) ?? null,
      website: nullIfBlank(body.website) ?? null,
      phone: nullIfBlank(body.phone) ?? null,
      created_by: userId,
    };
    let created: TourOperatorLookup | null;
    try {
      created = await tourOperatorSettingsRepository.create(values);
    } catch (err) {
      if (isUniqueViolation(err)) throw new AppError(`${body.name} is already in the catalogue`, 409);
      throw err;
    }
    if (!created) throw new AppError(`${body.name} is already in the catalogue`, 409);
    return created;
  },

  async update(id: string, body: CatalogueUpdateBody): Promise<TourOperatorLookup> {
    await requireOperator(id);
    if (body.name !== undefined) {
      const duplicate = await tourOperatorSettingsRepository.findByLowerName(body.name);
      if (duplicate && duplicate.id !== id) throw new AppError(`${body.name} is already in the catalogue`, 409);
    }
    const values: Partial<InsertTourOperatorLookup> = {};
    if (body.name !== undefined) values.name = body.name;
    if (body.code !== undefined) values.code = nullIfBlank(body.code);
    if (body.website !== undefined) values.website = nullIfBlank(body.website);
    if (body.phone !== undefined) values.phone = nullIfBlank(body.phone);
    let updated: TourOperatorLookup | null;
    try {
      updated = await tourOperatorSettingsRepository.update(id, values);
    } catch (err) {
      if (isUniqueViolation(err) && body.name) throw new AppError(`${body.name} is already in the catalogue`, 409);
      throw err;
    }
    if (!updated) throw new AppError(NOT_FOUND, 404);
    return updated;
  },

  /**
   * Refuses while anything uses the operator: deleting would cascade away every
   * agency's settings for it and block (or silently null) quotes and bookings.
   */
  async remove(id: string): Promise<void> {
    const row = await requireOperator(id);
    const refs = await tourOperatorSettingsRepository.countReferences(id);
    if (refs.links > 0 || refs.records > 0) {
      throw new AppError(
        `Used by ${refs.links} ${refs.links === 1 ? 'agency' : 'agencies'} and ${refs.records} ${refs.records === 1 ? 'quote or booking' : 'quotes or bookings'}, so it can't be deleted`,
        409,
      );
    }
    await removeStoredLogo(row, 'logo');
    await tourOperatorSettingsRepository.remove(id);
  },

  async uploadLogo(id: string, file: Express.Multer.File): Promise<TourOperatorLookup> {
    const row = await requireOperator(id);
    await removeStoredLogo(row, 'previous logo');
    const logo_url = await uploadImageToS3(file, LOGO_S3_PREFIX);
    const updated = await tourOperatorSettingsRepository.update(id, { logo_url });
    if (!updated) throw new AppError(NOT_FOUND, 404);
    return updated;
  },

  async deleteLogo(id: string): Promise<TourOperatorLookup> {
    const row = await requireOperator(id);
    await removeStoredLogo(row, 'logo');
    const updated = await tourOperatorSettingsRepository.update(id, { logo_url: null });
    if (!updated) throw new AppError(NOT_FOUND, 404);
    return updated;
  },
};
