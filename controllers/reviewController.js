const db = require('../config/db.js');
const dayjs = require('dayjs');

// Check if user has already reviewed a booking
const checkExistingReview = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const userId = req.user.user_id;

        const [reviews] = await db.query(
            `SELECT review_id, rating, comment, created_at 
             FROM reviews 
             WHERE booking_id = ? AND user_id = ?`,
            [bookingId, userId]
        );

        if (reviews.length > 0) {
            res.json({
                success: true,
                exists: true,
                review: reviews[0]
            });
        } else {
            res.json({
                success: true,
                exists: false
            });
        }
    } catch (error) {
        console.error('Error checking review:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to check review' 
        });
    }
};

// Submit a new review
const createReview = async (req, res) => {
    console.log('Logged-in user:', req.user);

    try {
        const { booking_id, experience_id, rating, comment } = req.body;
const userId = req.user.user_id;

        // Validation
        if (!booking_id || !experience_id || !rating || !comment) {
            return res.status(400).json({ 
                success: false,
                message: 'All fields are required (booking_id, experience_id, rating, comment)' 
            });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({ 
                success: false,
                message: 'Rating must be between 1 and 5' 
            });
        }

        if (comment.trim().length < 10) {
            return res.status(400).json({ 
                success: false,
                message: 'Review must be at least 10 characters' 
            });
        }

        // Verify booking belongs to user and is completed
        const [bookings] = await db.query(
            `SELECT booking_id, status, traveler_id, creator_id 
             FROM bookings 
             WHERE booking_id = ? AND traveler_id = ?`,
            [booking_id, userId]
        );

        if (bookings.length === 0) {
            return res.status(403).json({ 
                success: false,
                message: 'You can only review your own bookings' 
            });
        }

        if (bookings[0].status !== 'Completed') {
            return res.status(400).json({ 
                success: false,
                message: 'You can only review completed experiences' 
            });
        }

        // Check if review already exists
        const [existingReviews] = await db.query(
            `SELECT review_id FROM reviews WHERE booking_id = ? AND user_id = ?`,
            [booking_id, userId]
        );

        if (existingReviews.length > 0) {
            return res.status(400).json({ 
                success: false,
                message: 'You have already reviewed this experience' 
            });
        }

        // Get creator's user_id for the review
        const creatorId = bookings[0].creator_id;

        // Insert review
        const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
        const [result] = await db.query(
            `INSERT INTO reviews 
             (booking_id, experience_id, user_id, creator_id, rating, comment, created_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [booking_id, experience_id, userId, creatorId, rating, comment.trim(), now]
        );

        // Update experience average rating
        await updateExperienceRating(experience_id);

        // Send notification to creator
        const notificationService = require('../services/notificationService');
        const [users] = await db.query(
            `SELECT first_name FROM users WHERE user_id = ?`,
            [userId]
        );
        const reviewerName = users[0]?.first_name || 'A traveler';

        await notificationService.createNotification({
            user_id: creatorId,
            type: 'update',
            title: 'New Review Received!',
            description: `${reviewerName} left a ${rating}-star review for your experience.`,
            icon: 'star',
            icon_color: '#FCD34D',
            experience_id: experience_id,
            created_at: now
        });

        res.status(201).json({
            success: true,
            message: 'Review submitted successfully',
            review_id: result.insertId
        });

    } catch (error) {
        console.error('Error submitting review:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to submit review' 
        });
    }
};

// Get reviews for an experience
const getExperienceReviews = async (req, res) => {
    try {
        const { experienceId } = req.params;
        const { limit = 10, offset = 0 } = req.query;

        const [reviews] = await db.query(
            `SELECT 
                r.review_id,
                r.rating,
                r.comment,
                r.created_at,
                r.helpful_count,
                CONCAT(u.first_name, ' ', u.last_name) as user_name,
                u.profile_pic
             FROM reviews r
             JOIN users u ON r.user_id = u.user_id
             WHERE r.experience_id = ?
             ORDER BY r.created_at DESC
             LIMIT ? OFFSET ?`,
            [experienceId, parseInt(limit), parseInt(offset)]
        );

        // Get total count
        const [countResult] = await db.query(
            `SELECT COUNT(*) as total FROM reviews WHERE experience_id = ?`,
            [experienceId]
        );

        // Get average rating
        const [avgResult] = await db.query(
            `SELECT AVG(rating) as average_rating FROM reviews WHERE experience_id = ?`,
            [experienceId]
        );

        res.json({
            success: true,
            reviews,
            total: countResult[0].total,
            average_rating: parseFloat(avgResult[0].average_rating || 0).toFixed(2)
        });

    } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch reviews' 
        });
    }
};

// Get reviews by a specific user
const getUserReviews = async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 10, offset = 0 } = req.query;

        const [reviews] = await db.query(
            `SELECT 
                r.review_id,
                r.rating,
                r.comment,
                r.created_at,
                r.experience_id,
                e.title as experience_title
             FROM reviews r
             JOIN experience e ON r.experience_id = e.experience_id
             WHERE r.user_id = ?
             ORDER BY r.created_at DESC
             LIMIT ? OFFSET ?`,
            [userId, parseInt(limit), parseInt(offset)]
        );

        // Get total count
        const [countResult] = await db.query(
            `SELECT COUNT(*) as total FROM reviews WHERE user_id = ?`,
            [userId]
        );

        res.json({
            success: true,
            reviews,
            total: countResult[0].total
        });

    } catch (error) {
        console.error('Error fetching user reviews:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch user reviews' 
        });
    }
};

// Update a review
const updateReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const { rating, comment } = req.body;
        const userId = req.user.userId;

        // Validation
        if (!rating && !comment) {
            return res.status(400).json({ 
                success: false,
                message: 'No fields to update' 
            });
        }

        if (rating && (rating < 1 || rating > 5)) {
            return res.status(400).json({ 
                success: false,
                message: 'Rating must be between 1 and 5' 
            });
        }

        if (comment && comment.trim().length < 10) {
            return res.status(400).json({ 
                success: false,
                message: 'Review must be at least 10 characters' 
            });
        }

        // Verify review belongs to user
        const [reviews] = await db.query(
            `SELECT review_id, experience_id, user_id FROM reviews WHERE review_id = ?`,
            [reviewId]
        );

        if (reviews.length === 0) {
            return res.status(404).json({ 
                success: false,
                message: 'Review not found' 
            });
        }

        if (reviews[0].user_id !== userId) {
            return res.status(403).json({ 
                success: false,
                message: 'You can only update your own reviews' 
            });
        }

        // Build update query
        const updates = [];
        const values = [];

        if (rating) {
            updates.push('rating = ?');
            values.push(rating);
        }
        if (comment) {
            updates.push('comment = ?');
            values.push(comment.trim());
        }

        updates.push('updated_at = ?');
        values.push(dayjs().format('YYYY-MM-DD HH:mm:ss'));
        values.push(reviewId);

        // Update review
        await db.query(
            `UPDATE reviews SET ${updates.join(', ')} WHERE review_id = ?`,
            values
        );

        // Update experience rating if rating changed
        if (rating) {
            await updateExperienceRating(reviews[0].experience_id);
        }

        res.json({
            success: true,
            message: 'Review updated successfully'
        });

    } catch (error) {
        console.error('Error updating review:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to update review' 
        });
    }
};

// Delete a review
const deleteReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const userId = req.user.userId;

        // Verify review belongs to user
        const [reviews] = await db.query(
            `SELECT review_id, experience_id, user_id FROM reviews WHERE review_id = ?`,
            [reviewId]
        );

        if (reviews.length === 0) {
            return res.status(404).json({ 
                success: false,
                message: 'Review not found' 
            });
        }

        if (reviews[0].user_id !== userId) {
            return res.status(403).json({ 
                success: false,
                message: 'You can only delete your own reviews' 
            });
        }

        const experienceId = reviews[0].experience_id;

        // Delete review
        await db.query(`DELETE FROM reviews WHERE review_id = ?`, [reviewId]);

        // Update experience rating
        await updateExperienceRating(experienceId);

        res.json({
            success: true,
            message: 'Review deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting review:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to delete review' 
        });
    }
};

// Helper function to update experience average rating
const updateExperienceRating = async (experienceId) => {
    try {
        const [result] = await db.query(
            `SELECT 
                AVG(rating) as avg_rating,
                COUNT(*) as review_count
             FROM reviews 
             WHERE experience_id = ?`,
            [experienceId]
        );

        const avgRating = result[0].avg_rating || 0;
        const reviewCount = result[0].review_count || 0;

        await db.query(
            `UPDATE experience 
             SET average_rating = ?, review_count = ? 
             WHERE experience_id = ?`,
            [avgRating, reviewCount, experienceId]
        );
    } catch (error) {
        console.error('Error updating experience rating:', error);
        throw error;
    }
};

module.exports = {
    checkExistingReview,
    createReview,
    getExperienceReviews,
    getUserReviews,
    updateReview,
    deleteReview
};