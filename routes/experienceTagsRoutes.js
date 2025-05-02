// routes/experienceTagsRoutes.js
const express = require('express');
const router = express.Router();
const experienceTagsController = require('../controllers/experienceTagsController');

// Add tags to an experience
router.post('/create', experienceTagsController.addTagsToExperience);

// Get tags of an experience
router.get('/:experience_id/tags/', experienceTagsController.getTagsForExperience);
router.delete('/remove-tag', experienceTagsController.removeTagFromExperience);
module.exports = router;
