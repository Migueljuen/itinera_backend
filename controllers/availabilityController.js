require('dotenv').config();

const db = require('../config/db.js');
// Create availability for a specific experience
const createAvailability = async (req, res) => {
  const { experience_id, availability } = req.body;

  if (!experience_id || !availability || availability.length === 0) {
    return res.status(400).json({ message: 'Experience ID and availability are required' });
  }

  try {
    // Insert availability for each day
    for (const { day_of_week, start_time, end_time } of availability) {
      await db.query(
        'INSERT INTO experience_availability (experience_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?)',
        [experience_id, day_of_week, start_time, end_time]
      );
    }

    res.status(201).json({ message: 'Experience availability created successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Fetch availability for a specific experience
// const getAvailability = async (req, res) => {
//   const { experience_id } = req.params;

//   if (!experience_id) {
//     return res.status(400).json({ message: 'Experience ID is required' });
//   }

//   try {
//     const [availability] = await db.query(
//       'SELECT * FROM experience_availability WHERE experience_id = ?',
//       [experience_id]
//     );

//     res.status(200).json({ availability });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Server error' });
//   }
// };

const getAvailability = async (req, res) => {
  const { experience_id } = req.params;

  if (!experience_id) {
    return res.status(400).json({ message: 'Experience ID is required' });
  }

  try {
    // Fetch availability days for the experience
    const [availability] = await db.query(
      'SELECT availability_id, experience_id, day_of_week FROM experience_availability WHERE experience_id = ?',
      [experience_id]
    );

    // For each availability day, fetch its time slots
    for (const day of availability) {
      const [timeSlots] = await db.query(
        'SELECT slot_id, availability_id, start_time, end_time FROM availability_time_slots WHERE availability_id = ?',
        [day.availability_id]
      );
      day.time_slots = timeSlots;
    }

    res.status(200).json({ availability });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};


// Update availability for an experience (optional)
const updateAvailability = async (req, res) => {
  const { experience_id, availability } = req.body;

  if (!experience_id || !availability || availability.length === 0) {
    return res.status(400).json({ message: 'Experience ID and availability are required' });
  }

  try {
    // Remove existing availability for the experience
    await db.query('DELETE FROM experience_availability WHERE experience_id = ?', [experience_id]);

    // Insert updated availability
    for (const { day_of_week, start_time, end_time } of availability) {
      await db.query(
        'INSERT INTO experience_availability (experience_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?)',
        [experience_id, day_of_week, start_time, end_time]
      );
    }

    res.status(200).json({ message: 'Experience availability updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  createAvailability,
  getAvailability,
  updateAvailability,
};
