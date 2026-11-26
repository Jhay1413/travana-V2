import { z } from 'zod';

/** `GET /bookings/:id`: the booking's id (a uuid). Who is asking comes from the session, never from here. */
export const portalBookingDetailValidator = z.object({
  params: z.object({ id: z.string().uuid('Invalid booking id') }),
});
