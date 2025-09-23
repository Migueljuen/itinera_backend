const express = require('express');
const cors = require('cors');
const port = 3000;
const app = express();
const path = require('path');

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// User
const userRoutes = require('./routes/userRoutes');
app.use('/users', userRoutes);

// Destination
const destinationRoutes = require('./routes/destinationRoutes');
app.use('/destination', destinationRoutes);

// Experience
const experienceRoutes = require('./routes/experienceRoutes');
app.use('/experience', experienceRoutes);

const savedExperienceRoutes = require('./routes/savedExperienceRoutes');
app.use('/saved-experiences', savedExperienceRoutes);

// Availability
const availabilityRoutes = require('./routes/availabilityRoutes');
app.use('/experience/availability', availabilityRoutes);

// Tags
const tagRoutes = require('./routes/tagRoutes');
app.use('/tags', tagRoutes);

// Experience_Tags
const experienceTagsRoutes = require('./routes/experienceTagsRoutes');
app.use('/experience/', experienceTagsRoutes);

// Preference
const preferenceRoutes = require('./routes/preferenceRoutes');
app.use('/preference', preferenceRoutes);

// Itinerary
const itineraryRoutes = require('./routes/itineraryRoutes');
app.use('/itinerary', itineraryRoutes);

// Itinerary_Experience
const itineraryExperienceRoutes = require('./routes/itineraryExperienceRoutes');
app.use('/itinerary', itineraryExperienceRoutes);

// Booking
const bookingRoutes = require('./routes/bookingRoutes');
app.use('/booking', bookingRoutes);

// Login
const authRoutes = require('./routes/authRoutes');
app.use('/api', authRoutes);

// Notifications
const notificationRoutes = require('./routes/notificationRoutes');
app.use('/notifications', notificationRoutes);

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${port}`);
  
  // Start cron jobs after server is running
  initializeCronJobs();
});

// Initialize cron jobs
function initializeCronJobs() {
  console.log('🚀 Initializing cron jobs...');
  
  try {
    // Check if cron job files exist before requiring them
    const fs = require('fs');
    
    // Initialize notification cron if file exists
    const notificationCronPath = path.join(__dirname, 'cron', 'notificationCron.js');
    if (fs.existsSync(notificationCronPath)) {
      const { startNotificationCron } = require('./cron/notificationCron');
      startNotificationCron();
      console.log('✅ Notification cron job started');
    } else {
      console.log('⚠️  Notification cron file not found. Create ./cron/notificationCron.js');
    }
    
    // Initialize status update cron if file exists
    const statusCronPath = path.join(__dirname, 'cron', 'statusUpdateCron.js');
    if (fs.existsSync(statusCronPath)) {
      const { startStatusUpdateCron } = require('./cron/statusUpdateCron');
      startStatusUpdateCron();
      // console.log('✅ Status update cron job started');
    } else {
      console.log('⚠️  Status update cron file not found. Create ./cron/statusUpdateCron.js');
    }
    
    // console.log('🎯 All available cron jobs initialized');
    
  } catch (error) {
    console.error('❌ Error initializing cron jobs:', error);
    console.log('⚠️  Server will continue running without cron jobs');
  }
}


// booking CRON
const { setupBookingStatusCron } = require('./cron/bookingStatusCron');

// Start the cron job when your server starts
setupBookingStatusCron();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  app.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});