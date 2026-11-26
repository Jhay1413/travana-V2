import { z } from 'zod';
import { PORTAL_PASSPORT_SEXES, PORTAL_LEAD_PASSENGER_ID } from '@shared/portal-passengers';
import { ukDay } from './portal-summary.mapper';

const NAME_CHARS = /^[\p{L}\p{M}][\p{L}\p{M}'’\-. ]*$/u;

const name = (label: string, max: number) =>
  z
    .string({ required_error: `${label} is required`, invalid_type_error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} is too long`)
    .regex(NAME_CHARS, `${label} can only contain letters, spaces, hyphens and apostrophes`);

const ymd = (label: string) =>
  z
    .string({ required_error: `${label} is required`, invalid_type_error: `${label} is required` })
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${label} must be a real date`)
    .refine((v) => {
      const d = new Date(`${v}T00:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
    }, `${label} must be a real date`);

/** Empty string or null means "not given". */
const optionalYmd = (label: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === '' || ymd(label).safeParse(v).success, `${label} must be a real date`)
    .nullable()
    .optional();

const optionalNationality = z
  .string()
  .trim()
  .max(100, 'Nationality is too long')
  .refine((v) => v === '' || /^[\p{L}\p{M}][\p{L}\p{M}'’\-. ]*$/u.test(v), 'Nationality can only contain letters')
  .nullable()
  .optional();

const optionalSex = z
  .string()
  .trim()
  .refine((v) => v === '' || (PORTAL_PASSPORT_SEXES as readonly string[]).includes(v), 'Choose M, F or X')
  .nullable()
  .optional();

const passportBody = z
  .object({
    firstName: name('Given names', 150),
    surname: name('Surname', 100),
    dateOfBirth: ymd('Date of birth'),
    nationality: optionalNationality,
    sex: optionalSex,
    passportNumber: z
      .string({ required_error: 'Passport number is required', invalid_type_error: 'Passport number is required' })
      .trim()
      .regex(/^[A-Za-z0-9]{6,12}$/, 'Passport number must be 6 to 12 letters or digits'),
    passportIssueDate: optionalYmd('Date of issue'),
    passportExpiry: ymd('Expiry date'),
  })
  .superRefine((b, ctx) => {
    const today = ukDay(new Date());
    const issue = b.passportIssueDate || null;
    const add = (path: string, message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
    if (b.dateOfBirth < '1900-01-01' || b.dateOfBirth >= today) add('dateOfBirth', 'Date of birth must be in the past');
    if (issue && (issue > today || issue < '1950-01-01')) add('passportIssueDate', 'Date of issue must not be in the future');
    if (b.passportExpiry < '1990-01-01' || b.passportExpiry > `${Number(today.slice(0, 4)) + 20}-12-31`) add('passportExpiry', 'Expiry date does not look right');
    if (issue && b.passportExpiry <= issue) add('passportExpiry', 'Expiry date must be after the date of issue');
  });

export const portalPassengerParamsSchema = z.object({
  id: z.union([z.literal(PORTAL_LEAD_PASSENGER_ID), z.string().uuid('Passenger not found')]),
});

/** `PUT /passengers/:id/passport`: who is asking comes from the session; the id is checked for ownership in the service. */
export const portalSavePassportValidator = z.object({
  params: portalPassengerParamsSchema,
  body: passportBody,
});

/** `POST /passengers`: a new (non-lead) passenger for the signed-in customer. */
export const portalCreatePassengerValidator = z.object({
  body: passportBody,
});

export type PortalPassportBody = z.infer<typeof passportBody>;
