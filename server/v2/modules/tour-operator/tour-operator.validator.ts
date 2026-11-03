import { z } from 'zod';
import { OPERATOR_MESSAGES, PHONE_RE, normaliseWeb } from '@shared/tour-operator-rules';

export const MAX_IMPORT_ROWS = 500;

export const operatorNameField = z.string().trim().min(2, OPERATOR_MESSAGES.nameMin).max(120);

/** "" means "no phone" (or "clear it" on PATCH). */
export const operatorPhoneField = z
  .string()
  .trim()
  .max(40)
  .refine((v) => v === '' || PHONE_RE.test(v), OPERATOR_MESSAGES.phone);

/** "" means "no website"; anything else is normalised to a full URL. */
export const operatorWebsiteField = z
  .string()
  .trim()
  .max(300)
  .transform(normaliseWeb)
  .pipe(z.union([z.literal(''), z.string().url(OPERATOR_MESSAGES.web)]));

const commissionField = z
  .number({ invalid_type_error: OPERATOR_MESSAGES.commissionNumber })
  .min(0, OPERATOR_MESSAGES.commissionMin)
  .max(100, OPERATOR_MESSAGES.commissionMax);

const weeksField = z
  .number({ invalid_type_error: OPERATOR_MESSAGES.weeksNumber })
  .int(OPERATOR_MESSAGES.weeksWhole)
  .min(0, OPERATOR_MESSAGES.weeksMin)
  .max(52, OPERATOR_MESSAGES.weeksMax);

const linkId = z.string().uuid('linkId must be a valid id');

export const listQuery = z.object({ includeInactive: z.literal('1').optional() });

export const catalogueQuery = z.object({
  q: z.string().trim().max(80).optional(),
  all: z.literal('1').optional(),
});

export const createLinkBody = z
  .object({
    tourOperatorId: z.string().uuid('tourOperatorId must be a valid id').optional(),
    name: operatorNameField.optional(),
    website: operatorWebsiteField.optional(),
    phone: operatorPhoneField.optional(),
    commissionPercentage: commissionField,
    balanceDueWeeks: weeksField.default(14),
    username: z.string().trim().max(120).optional(),
    password: z.string().max(200).optional(),
  })
  .refine((b) => Boolean(b.tourOperatorId) !== Boolean(b.name), {
    message: 'Provide either tourOperatorId or name',
  });

export const patchLinkBody = z
  .object({
    name: operatorNameField.optional(),
    website: operatorWebsiteField.optional(),
    phone: operatorPhoneField.optional(),
    commissionPercentage: commissionField.nullable().optional(),
    balanceDueWeeks: weeksField.optional(),
    username: z.string().trim().max(120).optional(),
    /** Empty string clears the stored password. */
    password: z.string().max(200).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), { message: 'Nothing to update' });

const cell = z.string().max(500).optional();

export const importBody = z.object({
  rows: z
    .array(
      z.object({
        line: z.number().int().min(1),
        name: cell,
        phone: cell,
        website: cell,
        username: cell,
        password: cell,
        commission: cell,
        balanceWeeks: cell,
      }),
    )
    .min(1, 'That file has no tour operators in it.')
    .max(MAX_IMPORT_ROWS, 'That file has more than 500 rows. Split it into smaller files.'),
});

export const listValidator = z.object({ query: listQuery });
export const catalogueValidator = z.object({ query: catalogueQuery });
export const createValidator = z.object({ body: createLinkBody });
export const patchValidator = z.object({ params: z.object({ linkId }), body: patchLinkBody });
export const linkParamValidator = z.object({ params: z.object({ linkId }) });
export const importValidator = z.object({ body: importBody });

export type ListQuery = z.infer<typeof listQuery>;
export type CatalogueQuery = z.infer<typeof catalogueQuery>;
export type CreateLinkBody = z.infer<typeof createLinkBody>;
export type PatchLinkBody = z.infer<typeof patchLinkBody>;
export type ImportBody = z.infer<typeof importBody>;
