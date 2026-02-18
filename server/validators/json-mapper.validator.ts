import { z } from "zod";

export const mapToIdsValidator = z.object({
  body: z.object({
    country: z.string().optional(),
    destination: z.string().optional(),
    resort: z.string().optional(),
    accommodation: z.string().optional(),
    boardBasis: z.string().optional(),
    tourOperator: z.string().optional(),
    outboundDepartAirport: z.string().optional(),
    outboundArriveAirport: z.string().optional(),
    inboundDepartAirport: z.string().optional(),
    inboundArriveAirport: z.string().optional(),
    roomType: z.string().optional(),
  }),
});
