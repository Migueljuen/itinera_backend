// test-booking-status.js
const { updateBookingStatuses } = require('./cron/bookingStatusCron');

(async () => {
  try {
    console.log('🚀 Testing booking status update...');
    await updateBookingStatuses();
    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
})();