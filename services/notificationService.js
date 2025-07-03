// services/notificationService.js
const dayjs = require('dayjs');

class NotificationService {
  constructor(db) {
    this.db = db;
  }

  // Create immediate notification
  async createNotification(data) {
    try {
      const {
        user_id,
        type,
        title,
        description,
        itinerary_id,
        itinerary_item_id,
        experience_id,
        icon,
        icon_color,
        action_url,
        created_at
      } = data;

      const [result] = await this.db.query(
        `INSERT INTO notifications 
          (user_id, type, title, description, is_read, created_at, 
           itinerary_id, itinerary_item_id, experience_id, 
           icon, icon_color, action_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user_id,
          type,
          title,
          description,
          false, // is_read defaults to false
          created_at || dayjs().format('YYYY-MM-DD HH:mm:ss'),
          itinerary_id || null,
          itinerary_item_id || null,
          experience_id || null,
          icon || this.getDefaultIcon(type),
          icon_color || this.getDefaultColor(type),
          action_url || null
        ]
      );

      // If push notifications are enabled, send push notification
      if (this.isPushEnabled()) {
        await this.sendPushNotification(user_id, {
          title,
          body: description,
          data: {
            notificationId: result.insertId,
            type,
            itineraryId: itinerary_id
          }
        });
      }

      return { success: true, notificationId: result.insertId };
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  // Create scheduled notification (for future delivery)
  async createScheduledNotification(data) {
    try {
      const {
        user_id,
        type,
        title,
        description,
        scheduled_for,
        itinerary_id,
        itinerary_item_id,
        experience_id,
        icon,
        icon_color,
        created_at
      } = data;

      // Store in a scheduled notifications table
      const [result] = await this.db.query(
        `INSERT INTO scheduled_notifications 
          (user_id, type, title, description, scheduled_for, is_sent, created_at,
           itinerary_id, itinerary_item_id, experience_id, 
           icon, icon_color)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user_id,
          type,
          title,
          description,
          scheduled_for,
          false, // is_sent defaults to false
          created_at || dayjs().format('YYYY-MM-DD HH:mm:ss'),
          itinerary_id || null,
          itinerary_item_id || null,
          experience_id || null,
          icon || this.getDefaultIcon(type),
          icon_color || this.getDefaultColor(type)
        ]
      );

      return { success: true, scheduledNotificationId: result.insertId };
    } catch (error) {
      console.error('Error creating scheduled notification:', error);
      throw error;
    }
  }

  // Cancel scheduled notifications for an itinerary
  async cancelScheduledNotifications(itineraryId) {
    try {
      await this.db.query(
        `UPDATE scheduled_notifications 
         SET is_cancelled = true, cancelled_at = ?
         WHERE itinerary_id = ? AND is_sent = false AND scheduled_for > ?`,
        [
          dayjs().format('YYYY-MM-DD HH:mm:ss'),
          itineraryId,
          dayjs().format('YYYY-MM-DD HH:mm:ss')
        ]
      );

      return { success: true };
    } catch (error) {
      console.error('Error cancelling scheduled notifications:', error);
      throw error;
    }
  }

  // Process scheduled notifications (run this via cron job)
  async processScheduledNotifications() {
    try {
      const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
      
      // Get all pending scheduled notifications
      const [notifications] = await this.db.query(
        `SELECT * FROM scheduled_notifications 
         WHERE is_sent = false 
           AND is_cancelled = false 
           AND scheduled_for <= ?
         ORDER BY scheduled_for ASC
         LIMIT 100`,
        [now]
      );

      for (const notification of notifications) {
        try {
          // Create the actual notification
          await this.createNotification({
            user_id: notification.user_id,
            type: notification.type,
            title: notification.title,
            description: notification.description,
            itinerary_id: notification.itinerary_id,
            itinerary_item_id: notification.itinerary_item_id,
            experience_id: notification.experience_id,
            icon: notification.icon,
            icon_color: notification.icon_color
          });

          // Mark as sent
          await this.db.query(
            `UPDATE scheduled_notifications 
             SET is_sent = true, sent_at = ?
             WHERE id = ?`,
            [dayjs().format('YYYY-MM-DD HH:mm:ss'), notification.id]
          );
        } catch (error) {
          console.error(`Error processing scheduled notification ${notification.id}:`, error);
          // Continue processing other notifications
        }
      }

      return { success: true, processed: notifications.length };
    } catch (error) {
      console.error('Error processing scheduled notifications:', error);
      throw error;
    }
  }

  // Helper methods
  getDefaultIcon(type) {
    const icons = {
      reminder: 'time-outline',
      activity: 'location-outline',
      update: 'sync-outline',
      alert: 'alert-circle-outline',
      itinerary: 'map-outline'
    };
    return icons[type] || 'notifications-outline';
  }

  getDefaultColor(type) {
    const colors = {
      reminder: '#3B82F6',
      activity: '#10B981',
      update: '#F59E0B',
      alert: '#EF4444',
      itinerary: '#6366F1'
    };
    return colors[type] || '#6B7280';
  }

  // Check if push notifications are enabled
  isPushEnabled() {
    // You can check environment variables or user preferences here
    return process.env.PUSH_NOTIFICATIONS_ENABLED === 'true';
  }

  // Send push notification (implement based on your push service)
  async sendPushNotification(userId, notification) {
    try {
      // This is where you'd integrate with Expo Push Notifications
      // or another push notification service
      
      // Get user's push token
      const [user] = await this.db.query(
        'SELECT push_token FROM users WHERE id = ?',
        [userId]
      );

      if (user[0]?.push_token) {
        // Send to your push notification service
        console.log('Sending push notification to user:', userId);
        // Implement actual push notification sending here
      }
    } catch (error) {
      console.error('Error sending push notification:', error);
      // Don't throw - push notification failure shouldn't break the flow
    }
  }
}

// Export a singleton instance
module.exports = new NotificationService(require('../config/db.js'));