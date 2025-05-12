
const express = require('express');
const cors = require('cors');
const port = process.env.PORT || 3000;
const app = express();
const path = require('path');

// Middleware
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
};
app.use(cors(corsOptions));

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


//login
const authRoutes = require('./routes/authRoutes');
app.use('/api', authRoutes);

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${port}`);
});
