import { z } from 'zod';

const text = z.string().max(300);
const name = z.string().max(120);

const lineItem = z.object({ tourOperator: name.optional() }).passthrough();

// The mapper input is a loose scraped payload: known text fields are length
// capped, unknown keys pass through untouched (the service reads only what it knows).
export const mapToIdsBody = z
  .object({
    country: text.optional(),
    destination: text.optional(),
    resort: text.optional(),
    accommodation: text.optional(),
    boardBasis: text.optional(),
    roomType: text.optional(),
    tourOperator: name.optional(),
    extraAccommodations: z.array(lineItem).max(50).optional(),
    transfers: z.array(lineItem).max(50).optional(),
    carHires: z.array(lineItem).max(50).optional(),
    attractionTickets: z.array(lineItem).max(50).optional(),
    loungePasses: z.array(lineItem).max(50).optional(),
    airportParkings: z.array(lineItem).max(50).optional(),
  })
  .passthrough();

export const mapToIdsValidator = z.object({ body: mapToIdsBody });
