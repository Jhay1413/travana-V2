import { handleAuthed } from './portal-handlers';
import { portalSummaryService } from './portal-summary.service';

export const portalSummaryController = {
  summary: handleAuthed('Failed to load your summary', async (req, res) => {
    res.json(await portalSummaryService.getSummary(req.portalClient.clientId));
  }),
};
