// cron/notificationCron.js
const cron = require('node-cron');
const db = require('../config/db.js');

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

// Process scheduled notifications
const processScheduledNotifications = async () => {
  try {
    // Get all pending notifications that are due to be sent from scheduled_notifications table
    const [pendingNotifications] = await db.query(`
      SELECT 
        id,
        user_id,
        type,
        title,
        description,
        scheduled_for,
        created_at,
        itinerary_id,
        itinerary_item_id,
        experience_id,
        icon,
        icon_color,
        DATE_FORMAT(scheduled_for, '%Y-%m-%d %H:%i:%s') as formatted_scheduled
      FROM scheduled_notifications 
      WHERE is_sent = 0 
        AND is_cancelled = 0
        AND scheduled_for <= NOW()
      ORDER BY scheduled_for ASC
    `);

    console.log(`📋 Found ${pendingNotifications.length} pending notifications to process`);

    if (pendingNotifications.length === 0) {
      console.log('✅ No pending notifications to process');
      return {
        processed: 0,
        failed: 0,
        total: 0
      };
    }

    let processed = 0;
    let failed = 0;

    // Process each notification
    for (const notification of pendingNotifications) {
      try {
        console.log(`📤 Processing notification ${notification.id} for user ${notification.user_id}`);
        console.log(`   Type: ${notification.type}`);
        console.log(`   Title: ${notification.title}`);
        console.log(`   Scheduled for: ${notification.formatted_scheduled}`);

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

        // You can add additional processing here like:
        // - Send push notifications
        // - Send emails
        // - Trigger real-time updates
        // - Log to external services

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
      total: pendingNotifications.length
    };

    console.log(`📊 Notification processing complete:
      - ${result.processed} notifications sent
      - ${result.failed} notifications failed
      - ${result.total} total processed`);

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
    // Show current notification stats for both tables
    const [scheduledStats] = await db.query(`
      SELECT 
        CASE 
          WHEN is_sent = 1 THEN 'sent'
          WHEN is_cancelled = 1 THEN 'cancelled'
          ELSE 'pending'
        END as status,
        COUNT(*) as count,
        MIN(scheduled_for) as earliest_scheduled,
        MAX(scheduled_for) as latest_scheduled
      FROM scheduled_notifications 
      GROUP BY is_sent, is_cancelled
      ORDER BY is_sent, is_cancelled
    `);

    const [immediateStats] = await db.query(`
      SELECT 
        CASE 
          WHEN is_read = 1 THEN 'read'
          ELSE 'unread'
        END as status,
        COUNT(*) as count,
        MIN(created_at) as earliest_created,
        MAX(created_at) as latest_created
      FROM notifications 
      GROUP BY is_read
      ORDER BY is_read
    `);

    console.log('📊 Current scheduled notification statistics:');
    scheduledStats.forEach(stat => {
      console.log(`   ${stat.status}: ${stat.count} notifications`);
      if (stat.earliest_scheduled) {
        console.log(`     Earliest: ${stat.earliest_scheduled}`);
        console.log(`     Latest: ${stat.latest_scheduled}`);
      }
    });

    console.log('📊 Current immediate notification statistics:');
    immediateStats.forEach(stat => {
      console.log(`   ${stat.status}: ${stat.count} notifications`);
      if (stat.earliest_created) {
        console.log(`     Earliest: ${stat.earliest_created}`);
        console.log(`     Latest: ${stat.latest_created}`);
      }
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