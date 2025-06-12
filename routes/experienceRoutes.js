const express = require('express');
const router = express.Router();
const { upload, createExperienceHandler, createExperience, getAllExperience,getAvailableTimeSlots,getExperienceAvailability, getExperienceById, updateExperience, saveExperience,getActiveExperience , getSavedExperiences, getExperienceByUserID} = require('../controllers/experienceController.js');
// const authenticateToken = require('../middleware/auth');


router.post('/create', createExperienceHandler);
// router.post('/create', upload.array('image', 10), createExperience);
router.post('/save', saveExperience);
router.get('/saved/:user_id', getSavedExperiences);
router.get('/user/:user_id', getExperienceByUserID);
router.get('/:id/available-slots', getAvailableTimeSlots);
router.get('/:id/availability', getExperienceAvailability);

router.get('/', getAllExperience); 
router.get('/active', getActiveExperience);
router.put('/:id', upload.array('images'), updateExperience);
router.get('/:id', getExperienceById); // LAST!


module.exports = router;
