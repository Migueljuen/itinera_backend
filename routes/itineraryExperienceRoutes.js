const express = require('express');
const router = express.Router();
const itineraryExperienceController = require('../controllers/itineraryExperienceController');

// Route for adding experiences to an itinerary
router.post('/:itinerary_id/experiences', itineraryExperienceController.addExperienceToItinerary);

// Route for getting all experiences for a specific itinerary
router.get('/:itinerary_id/experiences', itineraryExperienceController.getExperiencesForItinerary);
router.put('/:itinerary_id/experiences', itineraryExperienceController.updateItineraryItems);

// Route for deleting an experience from an itinerary
router.delete('/:itinerary_id/experiences/:experience_id', itineraryExperienceController.deleteExperienceFromItinerary);

module.exports = router;
