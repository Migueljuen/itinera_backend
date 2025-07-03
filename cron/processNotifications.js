// cron/processNotifications.js
const cron = require('node-cron');
const notificationService = require('../services/notificationService');

// Run every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  try {
    await notificationService.processScheduledNotifications();
  } catch (error) {
    console.error('Cron job error:', error);
  }
});