const db = require('../config/db.js');

// Create Preference
const createPreference = async (req, res) => {
  const { traveler_id, tag_id, preference_level } = req.body;

  // Validate the request
  if (!traveler_id || !tag_id || !preference_level) {
    return res.status(400).json({ message: 'Traveler ID, Tag ID, and Preference Level are required' });
  }

  try {
    // Check if the traveler exists
    const [userExists] = await db.query('SELECT * FROM users WHERE user_id = ?', [traveler_id]);
    if (userExists.length === 0) {
      return res.status(404).json({ message: 'Traveler not found' });
    }

    // Check if the tag exists
    const [tagExists] = await db.query('SELECT * FROM experience_tags WHERE tag_id = ?', [tag_id]);
    if (tagExists.length === 0) {
      return res.status(404).json({ message: 'Tag not found' });
    }

    // Insert preference into the table
    await db.query(
      'INSERT INTO preferences (traveler_id, tag_id, preference_level) VALUES (?, ?, ?)',
      [traveler_id, tag_id, preference_level]
    );

    // Return success
    res.status(201).json({ message: 'Preference created successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get all preferences for a traveler
const getPreferencesByTraveler = async (req, res) => {
  const { traveler_id } = req.params;

  try {
    const [preferences] = await db.query(
      'SELECT p.preference_id, p.traveler_id, p.tag_id, p.preference_level, t.name AS tag_name ' +
      'FROM preferences p ' +
      'JOIN experience_tags et ON p.tag_id = et.tag_id ' + // Join with the experience_tags table
      'JOIN tags t ON et.tag_id = t.tag_id ' +  // Join with the tags table to get the tag name
      'WHERE p.traveler_id = ?',
      [traveler_id]
    );

    if (preferences.length === 0) {
      return res.status(404).json({ message: 'No preferences found for this traveler' });
    }

    res.status(200).json({ preferences });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};


// Update Preference
const updatePreference = async (req, res) => {
  const { preference_id } = req.params;
  const { preference_level } = req.body;

  if (!preference_level) {
    return res.status(400).json({ message: 'Preference Level is required' });
  }

  try {
    // Update preference in the table
    await db.query(
      'UPDATE preferences SET preference_level = ? WHERE preference_id = ?',
      [preference_level, preference_id]
    );

    res.status(200).json({ message: 'Preference updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Delete Preference
const deletePreference = async (req, res) => {
  const { preference_id } = req.params;

  try {
    // Delete preference from the table
    await db.query('DELETE FROM preferences WHERE preference_id = ?', [preference_id]);

    res.status(200).json({ message: 'Preference deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  createPreference,
  getPreferencesByTraveler,
  updatePreference,
  deletePreference,
};
