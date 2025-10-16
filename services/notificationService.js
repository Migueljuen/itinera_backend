// services/notificationService.js
const dayjs = require('dayjs');
const timezone = require('dayjs/plugin/timezone');
const utc = require('dayjs/plugin/utc');

dayjs.extend(utc);
dayjs.extend(timezone);

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
      booking_id, // 👈 add booking_id
      icon,
      icon_color,
      action_url,
      created_at
    } = data;

    const [result] = await this.db.query(
      `INSERT INTO notifications 
        (user_id, type, title, description, is_read, created_at, 
         itinerary_id, itinerary_item_id, experience_id, booking_id, 
         icon, icon_color, action_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        booking_id || null, // 👈 insert booking_id properly
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
          itineraryId: itinerary_id,
          bookingId: booking_id || null // 👈 include bookingId in push payload
        }
      });
    }

    return { success: true, notificationId: result.insertId };
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
}


  // Create scheduled notification WITH TIMEZONE SUPPORT
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

      // Get user's timezone
      const [user] = await this.db.query(
        'SELECT timezone FROM users WHERE id = ?',
        [user_id]
      );
      const userTimezone = user[0]?.timezone || 'UTC';

      // scheduled_for should be in user's local time
      // Store both local and UTC times for clarity
      const scheduledLocal = dayjs.tz(scheduled_for, userTimezone);
      const scheduledUTC = scheduledLocal.utc().format('YYYY-MM-DD HH:mm:ss');

      // Store in a scheduled notifications table
      const [result] = await this.db.query(
        `INSERT INTO scheduled_notifications 
          (user_id, type, title, description, scheduled_for, scheduled_for_utc, 
           user_timezone, is_sent, created_at, itinerary_id, itinerary_item_id, 
           experience_id, icon, icon_color)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user_id,
          type,
          title,
          description,
          scheduled_for, // Keep local time for reference
          scheduledUTC,  // UTC time for comparison
          userTimezone,
          false, // is_sent defaults to false
          created_at || dayjs().format('YYYY-MM-DD HH:mm:ss'),
          itinerary_id || null,
          itinerary_item_id || null,
          experience_id || null,
          icon || this.getDefaultIcon(type),
          icon_color || this.getDefaultColor(type)
        ]
      );

      console.log(`📅 Scheduled notification for user ${user_id}:`);
      console.log(`   Local time: ${scheduled_for} (${userTimezone})`);
      console.log(`   UTC time: ${scheduledUTC}`);
      console.log(`   Type: ${type}, Title: ${title}`);

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

  // Process scheduled notifications WITH TIMEZONE SUPPORT
  async processScheduledNotifications() {
    try {
      const nowUTC = dayjs().utc().format('YYYY-MM-DD HH:mm:ss');
      
      // Get all pending scheduled notifications
      // Now we check against UTC time for consistency
      const [notifications] = await this.db.query(
        `SELECT sn.*, u.timezone as current_user_timezone
         FROM scheduled_notifications sn
         JOIN users u ON sn.user_id = u.id
         WHERE sn.is_sent = false 
           AND sn.is_cancelled = false 
         ORDER BY sn.scheduled_for_utc ASC
         LIMIT 100`
      );

      console.log(`🔍 Found ${notifications.length} notifications to check`);

      const notificationsToSend = [];

      // Check each notification against user's current time
      for (const notification of notifications) {
        const userTimezone = notification.current_user_timezone || notification.user_timezone || 'UTC';
        const userNow = dayjs().tz(userTimezone);
        const scheduledTime = dayjs.tz(notification.scheduled_for, userTimezone);
        
        // Check if it's time to send in user's timezone
        if (userNow.isAfter(scheduledTime) || userNow.isSame(scheduledTime, 'minute')) {
          notificationsToSend.push(notification);
          console.log(`✅ Ready to send: ${notification.title} for user ${notification.user_id}`);
        } else {
          const minutesUntil = scheduledTime.diff(userNow, 'minute');
          console.log(`⏰ Not yet: ${notification.title} - ${minutesUntil} minutes remaining`);
        }
      }

      console.log(`📤 Sending ${notificationsToSend.length} notifications`);

      for (const notification of notificationsToSend) {
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

      return { 
        success: true, 
        checked: notifications.length,
        processed: notificationsToSend.length 
      };
    } catch (error) {
      console.error('Error processing scheduled notifications:', error);
      throw error;
    }
  }

  // Get user notifications with timezone-aware timestamps
  async getUserNotifications(userId, limit = 50) {
    try {
      // Get user's timezone
      const [user] = await this.db.query(
        'SELECT timezone FROM users WHERE id = ?',
        [userId]
      );
      const userTimezone = user[0]?.timezone || 'UTC';

      const [notifications] = await this.db.query(
        `SELECT 
          id,
          type,
          title,
          description,
          is_read,
          created_at,
          CONVERT_TZ(created_at, @@session.time_zone, ?) as local_created_at,
          itinerary_id,
          booking_id,
          icon,
          icon_color,
          action_url
         FROM notifications 
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
        [userTimezone, userId, limit]
      );

      // Format timestamps for display
      return notifications.map(notif => ({
        ...notif,
        formatted_time: dayjs(notif.created_at).tz(userTimezone).format('MMM D, h:mm A'),
        relative_time: this.getRelativeTime(notif.created_at, userTimezone)
      }));
    } catch (error) {
      console.error('Error getting user notifications:', error);
      throw error;
    }
  }

  // Helper to get relative time (e.g., "2 hours ago")
  getRelativeTime(timestamp, timezone) {
    const userNow = dayjs().tz(timezone);
    const notifTime = dayjs(timestamp).tz(timezone);
    const diffMinutes = userNow.diff(notifTime, 'minute');
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} min ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} hours ago`;
    if (diffMinutes < 10080) return `${Math.floor(diffMinutes / 1440)} days ago`;
    
    return notifTime.format('MMM D');
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

  // Debug method to check notification scheduling
  async debugUserNotifications(userId) {
    try {
      const [user] = await this.db.query(
        'SELECT id, email, timezone FROM users WHERE id = ?',
        [userId]
      );
      
      const [scheduled] = await this.db.query(
        `SELECT 
          type,
          title,
          scheduled_for,
          scheduled_for_utc,
          user_timezone,
          is_sent,
          is_cancelled
         FROM scheduled_notifications
         WHERE user_id = ?
         ORDER BY scheduled_for DESC
         LIMIT 10`,
        [userId]
      );

      const userTimezone = user[0]?.timezone || 'UTC';
      const userNow = dayjs().tz(userTimezone);

      console.log(`\n🔍 Debug info for user ${userId}:`);
      console.log(`   Email: ${user[0]?.email}`);
      console.log(`   Timezone: ${userTimezone}`);
      console.log(`   Current time: ${userNow.format('YYYY-MM-DD HH:mm:ss')}`);
      console.log(`\n📅 Scheduled notifications:`);
      
      scheduled.forEach(notif => {
        const scheduledTime = dayjs.tz(notif.scheduled_for, userTimezone);
        const status = notif.is_sent ? '✅ Sent' : notif.is_cancelled ? '❌ Cancelled' : '⏰ Pending';
        const timeUntil = scheduledTime.diff(userNow, 'minute');
        
        console.log(`   ${status} ${notif.title}`);
        console.log(`      Scheduled: ${scheduledTime.format('YYYY-MM-DD HH:mm')}`);
        if (!notif.is_sent && !notif.is_cancelled) {
          console.log(`      Time until: ${timeUntil > 0 ? `${timeUntil} minutes` : 'Should have been sent'}`);
        }
      });
    } catch (error) {
      console.error('Error in debug:', error);
    }
  }
}

// Export a singleton instance
module.exports = new NotificationService(require('../config/db.js'));