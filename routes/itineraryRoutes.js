const express = require('express');
const router = express.Router();
const itineraryController = require('../controllers/itineraryController');  // Adjust to your path
const generateItineraryController = require('../controllers/generateItineraryController'); // Adjust to your path
// Route to create a new itinerary
router.post('/create', itineraryController.createItinerary);
router.post('/generate', generateItineraryController.generateItinerary);

// Route to get all itineraries for a specific traveler
router.get('/traveler/:traveler_id', itineraryController.getItineraryByTraveler);
router.get('/:itinerary_id', itineraryController.getItineraryById);


router.get('/:itinerary_id/items', itineraryController.getItineraryItems);

// Route to get a specific itinerary by itinerary_id
// router.get('/:itinerary_id', itineraryController.getItineraryById);

// Route to update an itinerary
router.put('/:itinerary_id', itineraryController.updateItinerary);

// Route to delete an itinerary
router.delete('/:itinerary_id', itineraryController.deleteItinerary);

module.exports = router;
