// cron/statusUpdateCron.js
const cron = require('node-cron');
const { updateItineraryStatuses, getCurrentActivityInfo } = require('../controllers/itineraryController');
const db = require('../config/db.js');

// Run status updates every 15 minutes
const startStatusUpdateCron = () => {
  console.log('Starting itinerary status update cron job...');
  
  // Run every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    console.log('🔄 Running itinerary status update at:', new Date().toISOString());
    
    try {
      const result = await updateItineraryStatuses();
      console.log(`Status update complete:
        - ${result.ongoingUpdated} itineraries started
        - ${result.completedUpdated} itineraries completed`);
    } catch (error) {
      console.error('Error in status update cron:', error);
    }
  });

  // Run activity reminders every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    console.log('🔔 Checking for activity reminders at:', new Date().toISOString());
    
    try {
      // Get all ongoing itineraries
      const [ongoingItineraries] = await db.query(`
        SELECT itinerary_id FROM itinerary WHERE status = 'ongoing'
      `);
      
      // Check current activity for each ongoing itinerary
      for (const itinerary of ongoingItineraries) {
        await getCurrentActivityInfo(itinerary.itinerary_id);
      }
    } catch (error) {
      console.error('Error in activity reminder cron:', error);
    }
  });

  console.log('✅ Status update cron jobs started');
};

module.exports = { startStatusUpdateCron };



// const cron = require('node-cron');
// const { updateItineraryStatuses, getCurrentActivityInfo } = require('../controllers/itineraryController');
// const db = require('../config/db.js');

// // Manual trigger functions for testing
// const runStatusUpdateNow = async () => {
//   console.log('🔄 MANUAL TRIGGER: Running itinerary status update at:', new Date().toISOString());
  
//   try {
//     const result = await updateItineraryStatuses();
//     console.log(`Status update complete:
//       - ${result.ongoingUpdated} itineraries started
//       - ${result.completedUpdated} itineraries completed`);
//     return result;
//   } catch (error) {
//     console.error('Error in manual status update:', error);
//     throw error;
//   }
// };

// const runActivityRemindersNow = async () => {
//   console.log('🔔 MANUAL TRIGGER: Checking for activity reminders at:', new Date().toISOString());
  
//   try {
//     // Get all ongoing itineraries
//     const [ongoingItineraries] = await db.query(`
//       SELECT itinerary_id FROM itinerary WHERE status = 'ongoing'
//     `);
    
//     console.log(`Found ${ongoingItineraries.length} ongoing itineraries to check`);
    
//     // Check current activity for each ongoing itinerary
//     const results = [];
//     for (const itinerary of ongoingItineraries) {
//       const activityInfo = await getCurrentActivityInfo(itinerary.itinerary_id);
//       results.push({
//         itinerary_id: itinerary.itinerary_id,
//         ...activityInfo
//       });
//     }
    
//     return results;
//   } catch (error) {
//     console.error('Error in manual activity reminder check:', error);
//     throw error;
//   }
// };

// // Run status updates every 15 minutes
// const startStatusUpdateCron = () => {
//   console.log('Starting itinerary status update cron job...');
  
//   // Run immediately on startup for testing
//   if (process.env.NODE_ENV === 'development') {
//     console.log('🚀 Running initial status check in development mode...');
//     runStatusUpdateNow();
//   }
  
//   // Run every 15 minutes
//   cron.schedule('*/15 * * * *', runStatusUpdateNow);

//   // Run activity reminders every 5 minutes
//   cron.schedule('*/5 * * * *', runActivityRemindersNow);

//   console.log('✅ Status update cron jobs started');
// };

// module.exports = { 
//   startStatusUpdateCron,
//   runStatusUpdateNow,
//   runActivityRemindersNow
// };