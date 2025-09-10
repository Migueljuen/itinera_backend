
// controllers/notificationController.js
const db = require('../config/db.js');
const dayjs = require('dayjs');

// Get all notifications for a user
const getNotifications = async (req, res) => {
  try {
    const userId = req.user.user_id; // From auth middleware
    const { filter = 'all', limit = 20, offset = 0 } = req.query;

    let whereClause = 'WHERE n.user_id = ?';
    const params = [userId];

    if (filter === 'unread') {
      whereClause += ' AND n.is_read = false';
    } else if (filter === 'itineraries') {
      whereClause += ' AND n.type IN ("reminder", "itinerary")';
    } else if (filter === 'activities') {
      whereClause += ' AND n.type = "activity"';
    } else if (filter === 'updates') {
      whereClause += ' AND n.type IN ("update", "alert")';
    }

    // Get notifications with related data
    const [notifications] = await db.query(
      `SELECT 
        n.*,
        i.title as itinerary_title,
        i.start_date as itinerary_start_date,
        e.title as experience_name
      FROM notifications n
      LEFT JOIN itinerary i ON n.itinerary_id = i.itinerary_id
      LEFT JOIN experience e ON n.experience_id = e.experience_id
      ${whereClause}
      ORDER BY n.created_at DESC
      LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    // Get total count
    const [countResult] = await db.query(
      `SELECT COUNT(*) as total FROM notifications n ${whereClause}`,
      params
    );

    res.json({
      success: true,
      notifications,
      pagination: {
        total: countResult[0].total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
  }
};

// Get single notification by ID
const getNotificationById = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { id } = req.params;

    // Get notification with related data
    const [notifications] = await db.query(
      `SELECT 
        n.*,
        i.title as itinerary_title,
        i.start_date as itinerary_start_date,
        e.title as experience_name
      FROM notifications n
      LEFT JOIN itinerary i ON n.itinerary_id = i.itinerary_id
      LEFT JOIN experience e ON n.experience_id = e.experience_id
      WHERE n.id = ? AND n.user_id = ?`,
      [id, userId]
    );

    if (notifications.length === 0) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }

    res.json({
      success: true,
      notification: notifications[0]
    });
  } catch (error) {
    console.error('Error fetching notification:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch notification' });
  }
};

// Get unread notification count
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.user_id;
    
    const [result] = await db.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = false',
      [userId]
    );

    res.json({
      success: true,
      count: result[0].count
    });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({ success: false, error: 'Failed to get unread count' });
  }
};

// Mark notification as read
const markAsRead = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { id } = req.params; // Changed from notification_id to id

    const [result] = await db.query(
      `UPDATE notifications 
       SET is_read = true, read_at = ?
       WHERE id = ? AND user_id = ?`,
      [dayjs().format('YYYY-MM-DD HH:mm:ss'), id, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ success: false, error: 'Failed to mark as read' });
  }
};

// Mark all notifications as read
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.user_id;

    await db.query(
      `UPDATE notifications 
       SET is_read = true, read_at = ?
       WHERE user_id = ? AND is_read = false`,
      [dayjs().format('YYYY-MM-DD HH:mm:ss'), userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all as read:', error);
    res.status(500).json({ success: false, error: 'Failed to mark all as read' });
  }
};

// Delete notification
const deleteNotification = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { id } = req.params; // Changed from notification_id to id

    const [result] = await db.query(
      'DELETE FROM notifications WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ success: false, error: 'Failed to delete notification' });
  }
};

// Get notification preferences
const getPreferences = async (req, res) => {
  try {
    const userId = req.user.user_id;

    const [preferences] = await db.query(
      'SELECT * FROM notification_preferences WHERE user_id = ?',
      [userId]
    );

    // Return defaults if no preferences set
    const userPreferences = preferences[0] || {
      trip_reminders: true,
      activity_reminders: true,
      itinerary_updates: true,
      marketing_emails: false,
      days_before_trip: 3,
      days_before_activity: 1,
      quiet_hours_start: '22:00:00',
      quiet_hours_end: '08:00:00'
    };

    res.json({ success: true, preferences: userPreferences });
  } catch (error) {
    console.error('Error fetching preferences:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch preferences' });
  }
};

// Update notification preferences
const updatePreferences = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const updates = req.body;

    // Check if preferences exist
    const [existing] = await db.query(
      'SELECT user_id FROM notification_preferences WHERE user_id = ?',
      [userId]
    );

    if (existing.length > 0) {
      // Update existing preferences
      const updateFields = Object.keys(updates)
        .map(field => `${field} = ?`)
        .join(', ');
      
      await db.query(
        `UPDATE notification_preferences SET ${updateFields} WHERE user_id = ?`,
        [...Object.values(updates), userId]
      );
    } else {
      // Insert new preferences
      const fields = ['user_id', ...Object.keys(updates)];
      const placeholders = fields.map(() => '?').join(', ');
      
      await db.query(
        `INSERT INTO notification_preferences (${fields.join(', ')}) VALUES (${placeholders})`,
        [userId, ...Object.values(updates)]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({ success: false, error: 'Failed to update preferences' });
  }
};

module.exports = {
    getNotifications,
  getNotificationById, // NEW: Export the new function
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getPreferences,
  updatePreferences
};