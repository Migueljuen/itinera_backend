// test-cron.js
// Run this script to test cron jobs manually: node test-cron.js

const { runStatusUpdateNow, runActivityRemindersNow } = require('./cron/statusUpdateCron.js');
const { processNow } = require('./cron/notificationCron.js');

async function testAllCronJobs() {
  console.log('🧪 Testing all cron jobs...\n');
  
  // Test 1: Status Updates
  console.log('1️⃣ Testing Status Updates...');
  try {
    const statusResult = await runStatusUpdateNow();
    console.log('✅ Status update test completed:', statusResult);
  } catch (error) {
    console.error('❌ Status update test failed:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 2: Activity Reminders
  console.log('2️⃣ Testing Activity Reminders...');
  try {
    const activityResult = await runActivityRemindersNow();
    console.log('✅ Activity reminder test completed:', activityResult);
  } catch (error) {
    console.error('❌ Activity reminder test failed:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 3: Process Scheduled Notifications
  console.log('3️⃣ Testing Scheduled Notifications Processing...');
  try {
    const notificationResult = await processNow();
    console.log('✅ Notification processing test completed:', notificationResult);
  } catch (error) {
    console.error('❌ Notification processing test failed:', error.message);
  }
  
  console.log('\n🎯 All tests completed!');
  process.exit(0);
}

// Add command line options
const args = process.argv.slice(2);

if (args[0] === 'status') {
  console.log('🔄 Testing status updates only...\n');
  runStatusUpdateNow()
    .then((result) => {
      console.log('✅ Status update test completed:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Status update test failed:', error.message);
      process.exit(1);
    });
} else if (args[0] === 'activity') {
  console.log('🔔 Testing activity reminders only...\n');
  runActivityRemindersNow()
    .then((result) => {
      console.log('✅ Activity reminder test completed:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Activity reminder test failed:', error.message);
      process.exit(1);
    });
} else if (args[0] === 'notifications') {
  console.log('📧 Testing notifications only...\n');
  processNow()
    .then((result) => {
      console.log('✅ Notification processing test completed:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Notification processing test failed:', error.message);
      process.exit(1);
    });
} else {
  testAllCronJobs();
}