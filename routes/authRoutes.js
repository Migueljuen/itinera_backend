const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Login route
router.post('/login', authController.loginUser);
// router.put('/first-login/:id', authController.completeFirstLogin);
module.exports = router;


