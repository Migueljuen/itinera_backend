const express = require('express');
const router = express.Router();
const savedExperienceController = require('../controllers/savedExperienceController');

// Toggle save/unsave experience
router.post('/toggle', savedExperienceController.toggleSavedExperience);

// Check if specific experience is saved
router.get('/check/:experienceId', savedExperienceController.checkSavedStatus);

// Get all saved experiences for authenticated user
router.get('/', savedExperienceController.getSavedExperiences);

// Get only saved experience IDs (for bulk checking)
router.get('/ids', savedExperienceController.getSavedExperienceIds);

// Remove specific saved experience
router.delete('/:experienceId', savedExperienceController.removeSavedExperience);

// Bulk save experiences (for syncing)
router.post('/bulk', savedExperienceController.bulkSaveExperiences);

module.exports = router;