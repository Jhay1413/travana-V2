import { handleAuthed } from './portal-handlers';
import { portalQuotesService } from './portal-quotes.service';
import type { PortalQuoteActionBody } from './portal-quotes.validator';

export const portalQuotesController = {
  list: handleAuthed('Failed to load quotes', async (req, res) => {
    res.json(await portalQuotesService.listQuotes(req.portalClient.clientId));
  }),

  detail: handleAuthed('Failed to load quote', async (req, res) => {
    res.json(await portalQuotesService.getQuote(req.portalClient.clientId, String(req.params.token)));
  }),

  action: handleAuthed('Failed to save your answer', async (req, res) => {
    const { action, note, reason, wantsSimilar } = req.body as PortalQuoteActionBody;
    res.json(await portalQuotesService.recordAction(req.portalClient.clientId, String(req.params.token), { action, note, reason, wantsSimilar }));
  }),

  owns: handleAuthed('Failed to check quote access', async (req, res) => {
    res.json(await portalQuotesService.checkOwnership(req.portalClient.clientId, String(req.params.token)));
  }),
};
