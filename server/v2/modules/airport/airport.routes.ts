import { Router } from 'express';
import { airportController } from './airport.controller';

const router = Router();

router.get('/', airportController.listAirports);
router.post('/', airportController.createAirport);
router.delete('/:id', airportController.deleteAirport);

export default router;
