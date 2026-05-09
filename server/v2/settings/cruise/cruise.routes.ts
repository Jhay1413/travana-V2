import { Router } from 'express';
import { cruiseSettingsController } from './cruise.controller';

const router = Router();

// Cruise Lines
router.get('/lines', cruiseSettingsController.findAllLines);
router.get('/lines/:id', cruiseSettingsController.findLineById);
router.post('/lines', cruiseSettingsController.createLine);
router.patch('/lines/:id', cruiseSettingsController.updateLine);
router.delete('/lines/:id', cruiseSettingsController.removeLine);

// Cruise Ships
router.get('/ships', cruiseSettingsController.findAllShips);
router.get('/ships/:id', cruiseSettingsController.findShipById);
router.post('/ships', cruiseSettingsController.createShip);
router.patch('/ships/:id', cruiseSettingsController.updateShip);
router.delete('/ships/:id', cruiseSettingsController.removeShip);

// Cruise Itineraries
router.get('/itineraries', cruiseSettingsController.findAllItineraries);
router.get('/itineraries/:id', cruiseSettingsController.findItineraryById);
router.post('/itineraries', cruiseSettingsController.createItinerary);
router.patch('/itineraries/:id', cruiseSettingsController.updateItinerary);
router.delete('/itineraries/:id', cruiseSettingsController.removeItinerary);

export default router;
