const express = require('express');
const router = express.Router();
const { createAvailability, getAvailability, updateAvailability } = require('../controllers/availabilityController.js');
// const authenticateToken = require('../middleware/auth');


router.post('/create', createAvailability);


router.get('/:experience_id', getAvailability); 

// Update
router.put('/:id', updateAvailability); 

module.exports = router;
