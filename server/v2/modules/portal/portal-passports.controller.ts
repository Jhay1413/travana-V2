import { AppError } from '../../utils/error-handler';
import { handleAuthed } from './portal-handlers';
import { PASSPORT_NOT_AN_IMAGE_MESSAGE, portalPassportReadService } from './portal-passport-read.service';
import { portalPassportsService } from './portal-passports.service';
import { portalCreatePassengerValidator, portalSavePassportValidator } from './portal-passports.validator';

// The shared validate() middleware checks a request but hands the controller the ORIGINAL body. These handlers parse
// with the same schema again, so what reaches the service is the trimmed, normalised result (padded names, dates and
// numbers included). The middleware has already accepted the request, so the parse cannot fail here.

export const portalPassportsController = {
  list: handleAuthed('Failed to load your passengers', async (req, res) => {
    res.json(await portalPassportsService.list(req.portalClient.clientId));
  }),

  create: handleAuthed('Failed to save the passenger', async (req, res) => {
    const { body } = portalCreatePassengerValidator.parse({ body: req.body });
    res.status(201).json(await portalPassportsService.createPassenger(req.portalClient.clientId, body));
  }),

  save: handleAuthed('Failed to save the passport', async (req, res) => {
    const { params, body } = portalSavePassportValidator.parse({ params: req.params, body: req.body });
    res.json(await portalPassportsService.savePassport(req.portalClient.clientId, params.id, body));
  }),

  /** The photo arrives in memory (multer memoryStorage) and is never written anywhere. */
  read: handleAuthed('Failed to read the passport', async (req, res) => {
    if (!req.file) throw new AppError(PASSPORT_NOT_AN_IMAGE_MESSAGE, 400);
    // Stop the read when the customer disconnects before the answer is sent (a finished response is not a disconnect).
    const gone = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) gone.abort();
    });
    res.json(await portalPassportReadService.read(req.portalClient.clientId, req.file.buffer, gone.signal));
  }),
};
