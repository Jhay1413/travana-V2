import { z } from 'zod';

const dayHoursSchema = z.object({
  day:       z.string().min(1),
  open:      z.boolean(),
  openTime:  z.string().regex(/^\d{2}:\d{2}$/),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/),
});

const branchCoreFields = {
  name:             z.string().min(1, 'Branch name is required'),
  code:             z.string().max(10).optional().nullable(),
  address:          z.string().optional().nullable(),
  phone:            z.string().optional().nullable(),
  email:            z.string().email('Branch email must be valid').optional().nullable(),
  openingPattern:   z.enum(['mon-fri', 'mon-sat', 'seven-days']).optional().nullable(),
  bankHolidaysOpen: z.boolean().optional(),
  openingHours:     z.array(dayHoursSchema).length(7).optional(),
  isDefault:        z.boolean().optional(),
  isActive:         z.boolean().optional(),
};

export const createBranchSchema = z.object({
  body: z.object(branchCoreFields),
});

export const updateBranchSchema = z.object({
  body: z.object({
    name:             branchCoreFields.name.optional(),
    code:             branchCoreFields.code,
    address:          branchCoreFields.address,
    phone:            branchCoreFields.phone,
    email:            branchCoreFields.email,
    openingPattern:   branchCoreFields.openingPattern,
    bankHolidaysOpen: branchCoreFields.bankHolidaysOpen,
    openingHours:     branchCoreFields.openingHours,
    isDefault:        branchCoreFields.isDefault,
    isActive:         branchCoreFields.isActive,
  }),
});
