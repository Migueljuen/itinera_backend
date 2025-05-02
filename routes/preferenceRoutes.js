const express = require('express');
const router = express.Router();
const {
  createPreference,
  getPreferencesByTraveler,
  updatePreference,
  deletePreference,
} = require('../controllers/preferenceController');

// Route for creating a preference
router.post('/create', createPreference);

// Route for getting all preferences by traveler
router.get('/:traveler_id', getPreferencesByTraveler);

// Route for updating a specific preference
router.put('/:preference_id', updatePreference);

// Route for deleting a specific preference
router.delete('/:preference_id', deletePreference);

module.exports = router;
