const express = require('express');
const router = express.Router();
const itineraryController = require('../controllers/itineraryExperienceController');

// Route for adding experiences to an itinerary
// Bulk operations (recommended for better performance)
router.put('/:id/items/bulk-update', itineraryController.bulkUpdateItineraryItems);
router.delete('/:id/items/bulk-delete', itineraryController.bulkDeleteItineraryItems);

// Single item operations (alternative endpoints)
router.put('/:id/items/:item_id', itineraryController.updateItineraryItem);
router.delete('/:id/items/:item_id', itineraryController.deleteItineraryItem);
module.exports = router;
