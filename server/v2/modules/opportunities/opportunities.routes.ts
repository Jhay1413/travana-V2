import { Router } from 'express';
import { opportunitiesController } from './opportunities.controller';

const router = Router();

router.get('/enquiries', opportunitiesController.getEnquiries);
router.get('/quotes', opportunitiesController.getQuotes);
router.get('/bookings', opportunitiesController.getBookings);
router.get('/agents', opportunitiesController.getAgents);

export default router;
