import { z } from 'zod';
import {
  operatorNameField,
  operatorPhoneField,
  operatorWebsiteField,
} from '../../modules/tour-operator/tour-operator.validator';

/** Short tile code such as "J2". "" clears it. */
const codeField = z.string().trim().max(8, 'Use 8 characters or fewer for the code.');

// Unknown keys (logo_url, commission_percentage, org_id, ...) are stripped by Zod's
// default object behaviour: the catalogue holds identity only, and logos go through
// the dedicated upload endpoint.
export const catalogueCreateBody = z.object({
  name: operatorNameField,
  code: codeField.optional(),
  website: operatorWebsiteField.optional(),
  phone: operatorPhoneField.optional(),
});

export const catalogueUpdateBody = z
  .object({
    name: operatorNameField.optional(),
    code: codeField.optional(),
    website: operatorWebsiteField.optional(),
    phone: operatorPhoneField.optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), { message: 'Nothing to update' });

export const catalogueListQuery = z.object({
  page: z.string().regex(/^\d{1,6}$/, 'page must be a whole number').optional(),
  limit: z.string().regex(/^\d{1,3}$/, 'limit must be a whole number').optional(),
  search: z.string().trim().max(80).optional(),
});

const idParams = z.object({ id: z.string().uuid('id must be a valid id') });

export const listValidator = z.object({ query: catalogueListQuery });
export const idValidator = z.object({ params: idParams });
export const createValidator = z.object({ body: catalogueCreateBody });
export const updateValidator = z.object({ params: idParams, body: catalogueUpdateBody });

export type CatalogueCreateBody = z.infer<typeof catalogueCreateBody>;
export type CatalogueUpdateBody = z.infer<typeof catalogueUpdateBody>;
export type CatalogueListQuery = z.infer<typeof catalogueListQuery>;
