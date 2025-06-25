const express = require('express');
const router = express.Router();
const itineraryController = require('../controllers/itineraryController');
const generateItineraryController = require('../controllers/generateItineraryController');
const authenticateToken = require('../middleware/auth');

// SPECIFIC routes must come BEFORE generic parameter routes

// Route to create a new itinerary
router.post('/create', itineraryController.createItinerary);
router.post('/generate', generateItineraryController.generateItinerary);
router.post('/save', generateItineraryController.saveItinerary);

// Route to get all itineraries for a specific traveler
router.get('/traveler/:traveler_id', itineraryController.getItineraryByTraveler);

// ⚠️ IMPORTANT: Put specific routes BEFORE generic parameter routes
router.get('/item/:item_id', authenticateToken, itineraryController.getItineraryItemById);

// This MUST come AFTER /item/:item_id, otherwise it will catch "item" as an itinerary_id
router.get('/:itinerary_id', itineraryController.getItineraryById);
router.get('/:itinerary_id/items', itineraryController.getItineraryItems);

// Route to update an itinerary
router.put('/:itinerary_id', itineraryController.updateItinerary);

// Route to delete an itinerary
router.delete('/:itinerary_id', itineraryController.deleteItinerary);

module.exports = router;
