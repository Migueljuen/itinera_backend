const express = require('express');
const router = express.Router();
const savedExperienceController = require('../controllers/savedExperienceController');
const authenticateToken = require('../middleware/auth'); // Adjust path as needed

// Toggle save/unsave experience
router.post('/toggle', authenticateToken, savedExperienceController.toggleSavedExperience);

// Check if specific experience is saved
router.get('/check/:experienceId', authenticateToken, savedExperienceController.checkSavedStatus);

// Get all saved experiences for authenticated user
router.get('/', authenticateToken, savedExperienceController.getSavedExperiences);

// Get only saved experience IDs (for bulk checking)
router.get('/ids', authenticateToken, savedExperienceController.getSavedExperienceIds);

// Remove specific saved experience
router.delete('/:experienceId', authenticateToken, savedExperienceController.removeSavedExperience);

// Bulk save experiences (for syncing)
router.post('/bulk', authenticateToken, savedExperienceController.bulkSaveExperiences);

module.exports = router;