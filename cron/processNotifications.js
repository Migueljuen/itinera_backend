// cron/processNotifications.js
const cron = require('node-cron');
const notificationService = require('../services/notificationService');

// Since notificationCron.js already handles scheduled notifications every 2 minutes,
// this file might be redundant. Consider consolidating or clarifying the purpose.

// If this is meant to handle a different type of notification processing:
const startProcessNotificationsCron = () => {
  console.log('Starting process notifications cron job...');
  
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    console.log('📬 Running notification service at:', new Date().toISOString());
    
    try {
      // If notificationService has its own processScheduledNotifications,
      // make sure it's also timezone-aware
      await notificationService.processScheduledNotifications();
    } catch (error) {
      console.error('Process notifications cron error:', error);
    }
  });
  
  console.log('✅ Process notifications cron started');
};

module.exports = { startProcessNotificationsCron };