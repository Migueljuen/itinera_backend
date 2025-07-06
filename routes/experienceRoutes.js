const express = require('express');
const router = express.Router();
const { 
    upload, 
    createExperienceHandler, 
    createExperience, 
    createMultipleExperiences,  // Add this import
    getAllExperience,
    getAvailableTimeSlots,
    getExperienceAvailability, 
    getExperienceById, 
    updateExperience, 
    updateExperienceSection,
    updateExperienceStatus, 
    
    getActiveExperience, 
    getSavedExperiences, 
    getExperienceByUserID
} = require('../controllers/experienceController.js');
// const authenticateToken = require('../middleware/auth');

router.post('/create', createExperienceHandler);
router.post('/bulk', upload.array('images'), createMultipleExperiences);  // Add bulk endpoint
// router.post('/create', upload.array('image', 10), createExperience);

router.get('/user/:user_id', getExperienceByUserID);
router.get('/:id/available-slots', getAvailableTimeSlots);
router.get('/:id/availability', getExperienceAvailability);

router.get('/', getAllExperience); 
router.get('/active', getActiveExperience);

// Full update route
router.put('/:experience_id', upload.array('images'), updateExperience);

// Section-based update route (for updating specific parts)
router.put('/:experience_id/section', upload.array('images'), updateExperienceSection);

// CHANGED: Use PATCH instead of PUT to match your React Native code
router.patch('/:experience_id/status', updateExperienceStatus);

router.get('/:id', getExperienceById); // LAST!

module.exports = router;