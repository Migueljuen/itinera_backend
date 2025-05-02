const express = require('express');
const router = express.Router();
const { upload, createExperience, getAllExperience, getExperienceById, updateExperience } = require('../controllers/experienceController.js');
// const authenticateToken = require('../middleware/auth');


router.post('/create', createExperience);


// Get all destination
router.get('/', getAllExperience); 

// Get destination by ID
router.get('/:id', getExperienceById); 


// ADD IMAGES

router.put('/:id', upload.array('images'), updateExperience);

module.exports = router;
