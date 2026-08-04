import { z } from 'zod';

// Validates only the parts of the trade-portal offers API response we consume.
// Loose on purpose (`.passthrough()` everywhere): easyJet own this payload and
// can add fields freely — we only fail loudly when a field we actually map
// changes shape, which is the early-warning we want.

const imageSchema = z
  .object({
    large: z.string().optional(),
    medium: z.string().optional(),
    small: z.string().optional(),
  })
  .passthrough();

const routeSchema = z
  .object({
    depPt: z.string(),
    depDate: z.string(),
    depName: z.string().optional().default(''),
    arrPt: z.string(),
    arrDate: z.string(),
    arrName: z.string().optional().default(''),
    fltNo: z.string().optional().default(''),
    direction: z.enum(['outbound', 'inbound']),
  })
  .passthrough();

const unitSchema = z
  .object({
    code: z.string(),
    price: z.number().optional(),
    discount: z.number().optional(),
    currency: z.object({ code: z.string() }).passthrough().optional(),
    roomType: z
      .object({
        title: z.string().optional().default(''),
        images: z.array(imageSchema).optional().default([]),
      })
      .passthrough()
      .optional(),
    boardType: z
      .object({
        code: z.string().optional().default(''),
        title: z.string().optional().default(''),
      })
      .passthrough()
      .optional(),
    occupation: z
      .object({
        adults: z.number().optional(),
        children: z.number().optional(),
        infants: z.number().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const transferSchema = z
  .object({
    type: z.string().optional().default(''),
    name: z.string().optional().default(''),
    price: z.number().optional().default(0),
  })
  .passthrough();

const offerSchema = z
  .object({
    date: z.string(),
    stay: z.number(),
    price: z.number(),
    pricePP: z.number().optional().default(0),
    touristTax: z.number().optional().default(0),
    currency: z.object({ code: z.string() }).passthrough().optional(),
    accom: z
      .object({
        unit: z.array(unitSchema).min(1),
      })
      .passthrough(),
    transport: z
      .object({
        routes: z.array(routeSchema).optional().default([]),
      })
      .passthrough()
      .optional(),
    transfers: z.array(transferSchema).optional().default([]),
    promotion: z
      .object({
        title: z.string().optional().default(''),
        discountAmountPerBooking: z.number().optional().default(0),
      })
      .passthrough()
      .nullable()
      .optional(),
    extraLuggageInfo: z
      .object({
        items: z
          .array(
            z
              .object({
                name: z.string().optional().default(''),
                isComplimentary: z.boolean().optional().default(false),
              })
              .passthrough(),
          )
          .optional()
          .default([]),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

export const offersResponseSchema = z
  .object({
    hotel: z
      .object({
        name: z.string(),
        starRating: z.string().optional().default(''),
        rating: z.number().optional(),
        description: z.string().optional().default(''),
        images: z.array(imageSchema).optional().default([]),
        country: z.object({ name: z.string().optional().default('') }).passthrough().optional(),
        location: z.object({ name: z.string().optional().default('') }).passthrough().optional(),
        resort: z.object({ name: z.string().optional().default('') }).passthrough().optional(),
      })
      .passthrough(),
    offers: z.array(offerSchema).min(1),
  })
  .passthrough();

export type OffersResponse = z.infer<typeof offersResponseSchema>;
