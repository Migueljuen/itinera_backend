const express = require('express');
const router = express.Router();
const { createDestination, getAllDestination, getDestinationById,getDestinationByExperienceId, updateDestination } = require('../controllers/destinationController.js');
// const authenticateToken = require('../middleware/auth');


router.post('/create', createDestination);


// Get all destination
router.get('/', getAllDestination); 

// Get destination by ID
router.get('/:id', getDestinationById); 
router.get('/experience/:experienceId', getDestinationByExperienceId); 
// Update
router.put('/:id', updateDestination); 

module.exports = router;
