import { portalBookingDetailService } from './portal-booking-detail.service';
import { handleAuthed } from './portal-handlers';

export const portalBookingDetailController = {
  detail: handleAuthed('Failed to load booking', async (req, res) => {
    res.json(await portalBookingDetailService.getBooking(req.portalClient.clientId, String(req.params.id)));
  }),
};
