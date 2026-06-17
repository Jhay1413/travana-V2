import { Router, Request, Response } from 'express';
import { lookupService } from './lookup.service';

const router = Router();

router.get('/countries', async (_req: Request, res: Response) => {
  try {
    const rows = await lookupService.getCountries();
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/destinations', async (req: Request, res: Response) => {
  try {
    const rows = await lookupService.getDestinations({
      countryId: req.query.countryId as string | undefined,
      search: req.query.search as string | undefined,
      limit: (req.query.limit as string) ? parseInt(req.query.limit as string) : undefined,
    });
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/resorts', async (req: Request, res: Response) => {
  try {
    const rows = await lookupService.getResorts({
      destinationId: req.query.destinationId as string | undefined,
      countryId: req.query.countryId as string | undefined,
      search: req.query.search as string | undefined,
      limit: (req.query.limit as string) ? parseInt(req.query.limit as string, 10) : undefined,
    });
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/accommodations', async (req: Request, res: Response) => {
  try {
    const rows = await lookupService.getAccommodations({
      resortId: req.query.resortId as string | undefined,
      destinationId: req.query.destinationId as string | undefined,
      countryId: req.query.countryId as string | undefined,
      search: req.query.search as string | undefined,
      limit: (req.query.limit as string) ? parseInt(req.query.limit as string) : undefined,
    });
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/board-basis', async (_req: Request, res: Response) => {
  try {
    const rows = await lookupService.getBoardBasis();
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/parks', async (req: Request, res: Response) => {
  try {
    const rows = await lookupService.getParks(req.query.parkId as string | undefined);
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/lodges', async (req: Request, res: Response) => {
  try {
    const rows = await lookupService.getLodges(req.query.parkId as string | undefined);
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/package-types', async (_req: Request, res: Response) => {
  try {
    const rows = await lookupService.getPackageTypes();
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/accommodation-types', async (_req: Request, res: Response) => {
  try {
    const rows = await lookupService.getAccommodationTypes();
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/cottages', async (_req: Request, res: Response) => {
  try {
    const rows = await lookupService.getCottages();
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/room-types', async (_req: Request, res: Response) => {
  try {
    const rows = await lookupService.getRoomTypes();
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/accommodation-images', async (req: Request, res: Response) => {
  try {
    const accommodationId = req.query.accommodationId as string | undefined;
    if (!accommodationId) return res.json({ success: true, data: [] });
    const rows = await lookupService.getAccommodationImages(accommodationId);
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/lodge-images', async (req: Request, res: Response) => {
  try {
    const lodgeId = req.query.lodgeId as string | undefined;
    if (!lodgeId) return res.json({ success: true, data: [] });
    const rows = await lookupService.getLodgeImages(lodgeId);
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/cruise-lines', async (_req: Request, res: Response) => {
  try {
    const rows = await lookupService.getCruiseLines();
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/ships', async (req: Request, res: Response) => {
  try {
    const rows = await lookupService.getShips(req.query.cruiseLineId as string | undefined);
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/cruise-itineraries', async (req: Request, res: Response) => {
  try {
    const shipId = req.query.shipId as string | undefined;
    if (!shipId) return res.json({ success: true, data: [] });
    const rows = await lookupService.getCruiseItineraries(shipId);
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
