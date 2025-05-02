
const db = require('../config/db.js');

// Add experiences to an itinerary
const addExperienceToItinerary = async (req, res) => {
  const { itinerary_id, experience_id, scheduled_date, time_slot } = req.body;

  if (!itinerary_id || !experience_id || !scheduled_date || !time_slot) {
    return res.status(400).json({ message: 'Itinerary ID, Experience ID, Scheduled Date, and Time Slot are required' });
  }

  try {
    // Insert new experience into the itinerary_experience table
    await db.query(
      'INSERT INTO itinerary_experience (itinerary_id, experience_id, scheduled_date, time_slot) VALUES (?, ?, ?, ?)',
      [itinerary_id, experience_id, scheduled_date, time_slot]
    );

    res.status(201).json({ message: 'Experience added to itinerary successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get all experiences for a specific itinerary
const getExperiencesForItinerary = async (req, res) => {
  const { itinerary_id } = req.params;

  try {
    const [experiences] = await db.query(
      'SELECT * FROM itinerary_experience WHERE itinerary_id = ?',
      [itinerary_id]
    );

    if (experiences.length === 0) {
      return res.status(404).json({ message: 'No experiences found for this itinerary' });
    }

    res.status(200).json({ itinerary_experiences: experiences });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Delete an experience from an itinerary
const deleteExperienceFromItinerary = async (req, res) => {
  const { itinerary_id, experience_id } = req.params;

  try {
    const [result] = await db.query(
      'DELETE FROM itinerary_experience WHERE itinerary_id = ? AND experience_id = ?',
      [itinerary_id, experience_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Experience not found in this itinerary' });
    }

    res.status(200).json({ message: 'Experience removed from itinerary successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  addExperienceToItinerary,
  getExperiencesForItinerary,
  deleteExperienceFromItinerary
};
