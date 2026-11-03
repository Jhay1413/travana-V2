import { z } from 'zod';

const ymd = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').refine((v) => {
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}, 'Invalid date');

// Empty string is allowed and means "clear" (the service turns it into null).
const optionalDate = z.union([z.literal(''), ymd]).nullable();
const optionalText = (max: number) => z.string().trim().max(max).nullable();

const clientParams = z.object({ clientId: z.string().uuid() });
const passengerParams = z.object({ clientId: z.string().uuid(), passengerId: z.string().uuid() });

const passengerBody = z.object({
  title: optionalText(50).optional(),
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  surname: z.string().trim().min(1, 'Surname is required').max(100),
  dateOfBirth: optionalDate.optional(),
  passportNumber: optionalText(20).optional(),
  passportExpiry: optionalDate.optional(),
});

export const clientParamsValidator = z.object({ params: clientParams });

export const passengerParamsValidator = z.object({ params: passengerParams });

export const setLeadPassportValidator = z.object({
  params: clientParams,
  body: z.object({
    passportNumber: optionalText(20),
    passportExpiry: optionalDate,
  }),
});

// Adding a passenger requires all six fields. Updates stay partial so old records with gaps remain editable.
const createPassengerBody = z.object({
  title: z.string().trim().min(1, 'Title is required').max(50),
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  surname: z.string().trim().min(1, 'Surname is required').max(100),
  dateOfBirth: ymd,
  passportNumber: z.string().trim().min(1, 'Passport number is required').max(20),
  passportExpiry: ymd,
});

export const createPassengerValidator = z.object({
  params: clientParams,
  body: createPassengerBody,
});

export const updatePassengerValidator = z.object({
  params: passengerParams,
  body: passengerBody.partial(),
});
