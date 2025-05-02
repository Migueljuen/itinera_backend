const dayjs = require('dayjs');  // Import Day.js
const db = require('../config/db.js');

// Create a new itinerary
const createItinerary = async (req, res) => {
  const { traveler_id, start_date, end_date, title, notes, experience_ids } = req.body;

  // Validate required fields
  if (!traveler_id || !start_date || !end_date || !title || !experience_ids || experience_ids.length === 0) {
    return res.status(400).json({ message: 'Traveler ID, start date, end date, title, and experiences are required' });
  }

  try {
    const startDate = dayjs(start_date);
    const endDate = dayjs(end_date);

    if (startDate.isAfter(endDate)) {
      return res.status(400).json({ message: 'Start date cannot be after end date' });
    }

    // Insert the new itinerary into the database
    const [result] = await db.query(
      'INSERT INTO itinerary (traveler_id, start_date, end_date, title, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [traveler_id, startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD'), title, notes, dayjs().format('YYYY-MM-DD HH:mm:ss')]
    );

    // Make sure we have the insertId and it's valid
    const itinerary_id = result.insertId;
    console.log('New itinerary ID:', itinerary_id); // Debug log
    
    if (!itinerary_id) {
      throw new Error('Failed to get new itinerary ID');
    }

    // Create an array of values for the SQL query
    const experienceValues = [];
    
    // Generate default scheduled dates and time slots
    experience_ids.forEach((experience_id, index) => {
      // Calculate scheduled date (start date + index + 1 days)
      const scheduled_date = dayjs(start_date).add(index + 1, 'day').format('YYYY-MM-DD');
      
      // Define time slots (rotating)
      const time_slots = ['10:00 AM - 12:00 PM', '2:00 PM - 4:00 PM', '9:00 AM - 11:00 AM'];
      const time_slot = time_slots[index % time_slots.length];
      
      console.log(`Adding experience: ${itinerary_id}, ${experience_id}, ${scheduled_date}, ${time_slot}`); // Debug log
      experienceValues.push([itinerary_id, experience_id, scheduled_date, time_slot]);
    });
    
    // Check if we have experiences to insert and log the values for debugging
    if (experienceValues.length > 0) {
      console.log('Experience values to insert:', experienceValues); // Debug log
      
      // Insert experiences into itinerary_experience table
      await db.query(
        'INSERT INTO itinerary_experience (itinerary_id, experience_id, scheduled_date, time_slot) VALUES ?',
        [experienceValues]
      );
    }

    // Return success response
    res.status(201).json({ 
      message: 'Itinerary created successfully', 
      itinerary_id
    });
  } catch (err) {
    console.error('Error details:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};





// Get itinerary by traveler ID
const getItineraryByTraveler = async (req, res) => {
  const { traveler_id } = req.params;

  if (!traveler_id) {
    return res.status(400).json({ message: 'Traveler ID is required' });
  }

  try {
    const [itinerary] = await db.query(
      'SELECT * FROM itinerary WHERE traveler_id = ?',
      [traveler_id]
    );

    if (itinerary.length === 0) {
      return res.status(404).json({ message: 'No itinerary found for this traveler' });
    }

    // Format the dates using Day.js
    const formattedItinerary = itinerary.map(item => ({
      ...item,
      start_date: dayjs(item.start_date).format('YYYY-MM-DD'),
      end_date: dayjs(item.end_date).format('YYYY-MM-DD'),
      created_at: dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss')
    }));

    res.status(200).json({ itinerary: formattedItinerary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Update an itinerary
const updateItinerary = async (req, res) => {
  const { itinerary_id } = req.params;
  const { start_date, end_date, title, notes } = req.body;

  if (!start_date || !end_date || !title) {
    return res.status(400).json({ message: 'Start date, end date, and title are required' });
  }

  try {
    // Ensure the start date is before the end date
    const startDate = dayjs(start_date);
    const endDate = dayjs(end_date);

    if (startDate.isAfter(endDate)) {
      return res.status(400).json({ message: 'Start date cannot be after end date' });
    }

    // Update the itinerary
    await db.query(
      'UPDATE itinerary SET start_date = ?, end_date = ?, title = ?, notes = ? WHERE itinerary_id = ?',
      [startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD'), title, notes, itinerary_id]
    );

    res.status(200).json({ message: 'Itinerary updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Delete an itinerary
const deleteItinerary = async (req, res) => {
  const { itinerary_id } = req.params;

  try {
    await db.query('DELETE FROM itinerary WHERE itinerary_id = ?', [itinerary_id]);
    res.status(200).json({ message: 'Itinerary deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  createItinerary,
  getItineraryByTraveler,
  updateItinerary,
  deleteItinerary
};
