// // routes/notificationRoutes.js
// const express = require('express');
// const router = express.Router();
// const notificationController = require('../controllers/notificationController');
// const authenticateToken = require('../middleware/auth');

// // All notification routes require authentication
// router.use(authenticateToken);

// // Get all notifications for the authenticated user
// router.get('/', notificationController.getNotifications);

// // Get unread notification count
// router.get('/unread-count', notificationController.getUnreadCount);

// // Mark a specific notification as read
// router.put('/:notification_id/read', notificationController.markAsRead);

// // Mark all notifications as read
// router.put('/mark-all-read', notificationController.markAllAsRead);

// // Delete a specific notification
// router.delete('/:notification_id', notificationController.deleteNotification);

// // Get notification preferences
// // router.get('/preferences', notificationController.getPreferences);

// // // Update notification preferences
// // router.put('/preferences', notificationController.updatePreferences);

// module.exports = router;

// routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const authenticateToken = require('../middleware/auth');

// All notification routes require authentication
router.use(authenticateToken);

// Get all notifications for the authenticated user
router.get('/', notificationController.getNotifications);

// Get unread notification count
router.get('/unread-count', notificationController.getUnreadCount);

// Mark all notifications as read (must come before /:id routes)
router.put('/mark-all-read', notificationController.markAllAsRead);

// Mark a specific notification as read
router.put('/:id/read', notificationController.markAsRead);

// Delete a specific notification
router.delete('/:id', notificationController.deleteNotification);

// Get notification preferences
// router.get('/preferences', notificationController.getPreferences);

// Update notification preferences
// router.put('/preferences', notificationController.updatePreferences);

module.exports = router;