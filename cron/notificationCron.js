// cron/notificationCron.js
const cron = require('node-cron');
const db = require('../config/db.js');
const dayjs = require('dayjs');
const timezone = require('dayjs/plugin/timezone');
const utc = require('dayjs/plugin/utc');

dayjs.extend(utc);
dayjs.extend(timezone);

// Start notification processing cron job
const startNotificationCron = () => {
  console.log('Starting notification processing cron job...');
  
  // Process notifications every 2 minutes
  cron.schedule('*/2 * * * *', async () => {
    console.log('📧 Processing scheduled notifications at:', new Date().toISOString());
    
    try {
      await processScheduledNotifications();
    } catch (error) {
      console.error('Error in notification cron:', error);
    }
  });

  console.log('✅ Notification cron job started');
};

// Process scheduled notifications WITH TIMEZONE SUPPORT
const processScheduledNotifications = async () => {
  try {
    // Get all pending notifications with user timezone info
    const [pendingNotifications] = await db.query(`
      SELECT 
        sn.id,
        sn.user_id,
        sn.type,
        sn.title,
        sn.description,
        sn.scheduled_for,
        sn.created_at,
        sn.itinerary_id,
        sn.itinerary_item_id,
        sn.experience_id,
        sn.icon,
        sn.icon_color,
        DATE_FORMAT(sn.scheduled_for, '%Y-%m-%d %H:%i:%s') as formatted_scheduled,
        COALESCE(u.timezone, 'UTC') as user_timezone
      FROM scheduled_notifications sn
      JOIN users u ON sn.user_id = u.user_id
      WHERE sn.is_sent = 0 
        AND sn.is_cancelled = 0
      ORDER BY sn.scheduled_for ASC
    `);

    console.log(`📋 Found ${pendingNotifications.length} total notifications to check`);

    if (pendingNotifications.length === 0) {
      console.log('✅ No notifications to check');
      return {
        processed: 0,
        failed: 0,
        total: 0
      };
    }

    let processed = 0;
    let failed = 0;
    const notificationsToProcess = [];

    // Check each notification against user's local time
    for (const notification of pendingNotifications) {
      const userNow = dayjs().tz(notification.user_timezone);
      const scheduledTime = dayjs.tz(notification.scheduled_for, notification.user_timezone);
      
      console.log(`🔍 Checking notification ${notification.id}:`);
      console.log(`   User timezone: ${notification.user_timezone}`);
      console.log(`   User's current time: ${userNow.format('YYYY-MM-DD HH:mm:ss')}`);
      console.log(`   Scheduled for: ${scheduledTime.format('YYYY-MM-DD HH:mm:ss')}`);
      console.log(`   Should send: ${userNow.isAfter(scheduledTime) ? 'YES' : 'NO'}`);
      
      if (userNow.isAfter(scheduledTime) || userNow.isSame(scheduledTime, 'minute')) {
        notificationsToProcess.push(notification);
      }
    }

    console.log(`📤 ${notificationsToProcess.length} notifications ready to send`);

    // Process each notification that's due
    for (const notification of notificationsToProcess) {
      try {
        console.log(`📤 Processing notification ${notification.id} for user ${notification.user_id}`);
        console.log(`   Type: ${notification.type}`);
        console.log(`   Title: ${notification.title}`);
        console.log(`   User timezone: ${notification.user_timezone}`);

        // Move notification from scheduled_notifications to notifications table
        await db.query(`
          INSERT INTO notifications (
            user_id, type, title, description, itinerary_id, 
            itinerary_item_id, experience_id, icon, icon_color, 
            is_read, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW())
        `, [
          notification.user_id,
          notification.type,
          notification.title,
          notification.description,
          notification.itinerary_id,
          notification.itinerary_item_id,
          notification.experience_id,
          notification.icon,
          notification.icon_color
        ]);

        // Mark scheduled notification as sent
        await db.query(`
          UPDATE scheduled_notifications 
          SET is_sent = 1, 
              sent_at = NOW()
          WHERE id = ?
        `, [notification.id]);

        console.log(`✅ Successfully processed notification ${notification.id}`);
        processed++;

      } catch (error) {
        console.error(`❌ Failed to process notification ${notification.id}:`, error);
        failed++;
      }
    }

    const result = {
      processed,
      failed,
      total: notificationsToProcess.length,
      checked: pendingNotifications.length
    };

    console.log(`📊 Notification processing complete:
      - ${result.checked} notifications checked
      - ${result.processed} notifications sent
      - ${result.failed} notifications failed`);

    return result;

  } catch (error) {
    console.error('Error in processScheduledNotifications:', error);
    throw error;
  }
};

// Function to manually process notifications (for testing)
const processNow = async () => {
  console.log('🧪 Manual notification processing started...');
  
  try {
    // Show current server time and timezone
    console.log(`🕐 Server time: ${new Date().toISOString()}`);
    console.log(`🕐 Server timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
    
    // Show user timezones
    const [userTimezones] = await db.query(`
      SELECT DISTINCT timezone, COUNT(*) as user_count 
      FROM users 
      WHERE timezone IS NOT NULL 
      GROUP BY timezone
    `);
    
    console.log('🌍 User timezones:');
    userTimezones.forEach(tz => {
      const localTime = dayjs().tz(tz.timezone).format('YYYY-MM-DD HH:mm:ss');
      console.log(`   ${tz.timezone}: ${tz.user_count} users (local time: ${localTime})`);
    });
    
    // Show upcoming notifications by timezone
    const [upcomingByTimezone] = await db.query(`
      SELECT 
        u.timezone,
        COUNT(*) as notification_count,
        MIN(sn.scheduled_for) as next_notification
      FROM scheduled_notifications sn
      JOIN users u ON sn.user_id = u.user_id
      WHERE sn.is_sent = 0 AND sn.is_cancelled = 0
      GROUP BY u.timezone
      ORDER BY u.timezone
    `);
    
    console.log('\n📅 Upcoming notifications by timezone:');
    upcomingByTimezone.forEach(tz => {
      const userNow = dayjs().tz(tz.timezone || 'UTC');
      const nextTime = dayjs.tz(tz.next_notification, tz.timezone || 'UTC');
      const minutesUntil = nextTime.diff(userNow, 'minute');
      
      console.log(`   ${tz.timezone || 'UTC'}: ${tz.notification_count} pending`);
      console.log(`     Next in ${minutesUntil} minutes (${nextTime.format('HH:mm')})`);
    });
    
    // Process the notifications
    const result = await processScheduledNotifications();
    
    console.log('✅ Manual notification processing completed');
    return result;
    
  } catch (error) {
    console.error('❌ Manual notification processing failed:', error);
    throw error;
  }
};

// Clean up old notifications (run less frequently)
const cleanupOldNotifications = async () => {
  try {
    // Delete old sent scheduled notifications (older than 30 days)
    const [scheduledResult] = await db.query(`
      DELETE FROM scheduled_notifications 
      WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
        AND is_sent = 1
    `);

    // Delete old read immediate notifications (older than 30 days)
    const [immediateResult] = await db.query(`
      DELETE FROM notifications 
      WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
        AND is_read = 1
    `);

    const totalCleaned = scheduledResult.affectedRows + immediateResult.affectedRows;
    console.log(`🧹 Cleaned up ${totalCleaned} old notifications (${scheduledResult.affectedRows} scheduled, ${immediateResult.affectedRows} immediate)`);
    return totalCleaned;
    
  } catch (error) {
    console.error('Error cleaning up old notifications:', error);
    throw error;
  }
};

// Enhanced cron with cleanup (runs daily at 2 AM)
const startNotificationCronWithCleanup = () => {
  startNotificationCron();
  
  // Daily cleanup at 2 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('🧹 Running daily notification cleanup at:', new Date().toISOString());
    
    try {
      await cleanupOldNotifications();
    } catch (error) {
      console.error('Error in notification cleanup cron:', error);
    }
  });
  
  console.log('✅ Notification cron with cleanup started');
};

module.exports = { 
  startNotificationCron,
  startNotificationCronWithCleanup,
  processScheduledNotifications,
  processNow,
  cleanupOldNotifications
};