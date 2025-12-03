const express = require('express');
const router = express.Router();
const {
    checkExistingReview,
    createReview,
    getExperienceReviews,
    getUserReviews,
    updateReview,
    deleteReview
} = require('../controllers/reviewController.js');
const authenticateToken = require('../middleware/auth');

// Check if user already reviewed a booking (protected)
router.get('/booking/:bookingId/check', authenticateToken, checkExistingReview);

// Create a new review (protected)
router.post('/', authenticateToken, createReview);

// Get reviews for a specific experience (public)
router.get('/experience/:experienceId', getExperienceReviews);

// Get all reviews by a specific user (public)
router.get('/user/:userId', getUserReviews);

// Update a review (protected)
router.put('/:reviewId', authenticateToken, updateReview);

// Delete a review (protected)
router.delete('/:reviewId', authenticateToken, deleteReview);

module.exports = router;