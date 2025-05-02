const express = require('express');
const router = express.Router();
const itineraryController = require('../controllers/itineraryController');  // Adjust to your path

// Route to create a new itinerary
router.post('/create', itineraryController.createItinerary);

// Route to get all itineraries for a specific traveler
router.get('/traveler/:traveler_id', itineraryController.getItineraryByTraveler);

// Route to get a specific itinerary by itinerary_id
// router.get('/:itinerary_id', itineraryController.getItineraryById);

// Route to update an itinerary
router.put('/:itinerary_id', itineraryController.updateItinerary);

// Route to delete an itinerary
router.delete('/:itinerary_id', itineraryController.deleteItinerary);

module.exports = router;
