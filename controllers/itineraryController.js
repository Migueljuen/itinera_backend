const dayjs = require('dayjs');  // Import Day.js
const db = require('../config/db.js');

const createItinerary = async (req, res) => {
  const { traveler_id, start_date, end_date, title, notes, items } = req.body;

  // Validate required fields
  if (!traveler_id || !start_date || !end_date || !title || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Traveler ID, start date, end date, title, and items are required' });
  }

  try {
    const startDate = dayjs(start_date);
    const endDate = dayjs(end_date);

    if (startDate.isAfter(endDate)) {
      return res.status(400).json({ message: 'Start date cannot be after end date' });
    }

    const totalDays = endDate.diff(startDate, 'day') + 1;

    // Validate each item
    for (const item of items) {
      const { experience_id, day_number, start_time, end_time } = item;
      if (!experience_id || !day_number || !start_time || !end_time) {
        return res.status(400).json({ message: 'Each item must include experience_id, day_number, start_time, and end_time' });
      }

      if (day_number < 1 || day_number > totalDays) {
        return res.status(400).json({ message: `Invalid day_number: must be between 1 and ${totalDays}` });
      }
    }

    // Insert into itinerary table
    const [result] = await db.query(
      `INSERT INTO itinerary (traveler_id, start_date, end_date, title, notes, created_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [traveler_id, start_date, end_date, title, notes || '', dayjs().format('YYYY-MM-DD'), 'upcoming']
    );

    const itinerary_id = result.insertId;

    if (!itinerary_id) {
      throw new Error('Failed to create itinerary');
    }

    // Prepare values for batch insert into itinerary_items
    const itemValues = items.map(item => [
      itinerary_id,
      item.experience_id,
      item.day_number,
      item.start_time,
      item.end_time,
      item.custom_note || '',
      dayjs().format('YYYY-MM-DD HH:mm:ss'),
      dayjs().format('YYYY-MM-DD HH:mm:ss')
    ]);

    await db.query(
      `INSERT INTO itinerary_items 
        (itinerary_id, experience_id, day_number, start_time, end_time, custom_note, created_at, updated_at)
       VALUES ?`,
      [itemValues]
    );

    res.status(201).json({ message: 'Itinerary created successfully', itinerary_id });

  } catch (err) {
    console.error('Error creating itinerary:', err);
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


const getItineraryItems = async (req, res) => {
  const { itinerary_id } = req.params;

  if (!itinerary_id) {
    return res.status(400).json({ message: 'Itinerary ID is required' });
  }

  try {
    const [items] = await db.query(
      `SELECT 
         ii.item_id,
         ii.experience_id,
         ii.day_number,
         ii.start_time,
         ii.end_time,
         ii.custom_note,
         ii.created_at,
         ii.updated_at,
         e.title AS experience_name, 
         e.description AS experience_description
       FROM itinerary_items ii
       LEFT JOIN experience e ON ii.experience_id = e.experience_id
       WHERE ii.itinerary_id = ?
       ORDER BY ii.day_number, ii.start_time`,
      [itinerary_id]
    );

    res.status(200).json({ itinerary_id, items });
  } catch (err) {
    console.error('Error fetching itinerary items:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
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
  getItineraryItems,
  updateItinerary,
  deleteItinerary,
  
};
