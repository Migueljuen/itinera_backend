require('dotenv').config();
const db = require('../config/db.js');

// Create a booking
const createBooking = async (req, res) => {
  const {
    itinerary_id,
    item_id,
    experience_id,
    slot_id,
    traveler_id,
    creator_id,
    status,
    payment_status,
  } = req.body;

  if (!itinerary_id || !item_id || !experience_id || !slot_id || !traveler_id || !creator_id) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO bookings 
        (itinerary_id, item_id, experience_id, slot_id, traveler_id, creator_id, status, payment_status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        itinerary_id,
        item_id,
        experience_id,
        slot_id,
        traveler_id,
        creator_id,
        status || 'Confirmed',
        payment_status || 'Unpaid',
      ]
    );

    res.status(201).json({
      message: 'Booking created successfully',
      booking_id: result.insertId,
    });
  } catch (err) {
    console.error('Error creating booking:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Fetch all bookings (with slot details)
const getAllBookings = async (req, res) => {
  try {
    // Get all bookings
    const [bookings, fields] = await db.query(
      `SELECT 
        b.*, 
        ats.start_time, ats.end_time, ea.day_of_week,
        u.first_name AS traveler_first_name,
        u.last_name AS traveler_last_name,
        u.email AS traveler_email,
        u.profile_pic AS traveler_profile_pic,
        e.title AS experience_title
      FROM bookings b
      JOIN availability_time_slots ats ON b.slot_id = ats.slot_id
      JOIN experience_availability ea ON ats.availability_id = ea.availability_id
      JOIN users u ON b.traveler_id = u.user_id
      JOIN experience e ON b.experience_id = e.experience_id
      ORDER BY b.created_at DESC`
    );

    if (!bookings || bookings.length === 0) {
      return res.status(404).json({ message: 'No bookings found' });
    }

    res.status(200).json({ bookings }); // bookings is an array
  } catch (err) {
    console.error('Error fetching bookings:', err);
    res.status(500).json({ error: 'Server error' });
  }
};


// Fetch a single booking by ID (with slot details)
const getBookingById = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: 'Booking ID is required' });
  }

  try {
    const [booking] = await db.query(
      `SELECT 
        b.*, 
        ats.start_time, ats.end_time, ea.day_of_week
       FROM bookings b
       JOIN availability_time_slots ats ON b.slot_id = ats.slot_id
       JOIN experience_availability ea ON ats.availability_id = ea.availability_id
       WHERE b.booking_id = ?`,
      [id]
    );

    if (booking.length === 0) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.status(200).json({ booking: booking[0] });
  } catch (err) {
    console.error('Error fetching booking:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

const getBookingByCreatorId = async (req, res) => {
  const { creatorId } = req.params;

  if (!creatorId) {
    return res.status(400).json({ message: 'Creator ID is required' });
  }

  try {
    // Execute query
const [rows] = await db.query(
  `SELECT 
    b.booking_id,
    b.itinerary_id,
    b.item_id,
    b.experience_id,
    b.traveler_id,
    b.creator_id,
    b.status,
    b.payment_status,
    b.booking_date,
    b.created_at,
    b.updated_at,
    -- Prefer slot times, otherwise use itinerary item times
    COALESCE(ats.start_time, ii.start_time) AS start_time,
    COALESCE(ats.end_time, ii.end_time) AS end_time,
    COALESCE(ea.day_of_week, DAYNAME(b.booking_date)) AS day_of_week,
    u.first_name AS traveler_first_name, 
    u.last_name AS traveler_last_name, 
    u.email AS traveler_email,
    u.profile_pic AS traveler_profile_pic,
    e.title AS experience_title
  FROM bookings b
  LEFT JOIN availability_time_slots ats ON b.slot_id = ats.slot_id
  LEFT JOIN experience_availability ea ON ats.availability_id = ea.availability_id
  LEFT JOIN itinerary_items ii ON b.item_id = ii.item_id
  JOIN users u ON b.traveler_id = u.user_id
  JOIN experience e ON b.experience_id = e.experience_id
  WHERE b.creator_id = ?
  ORDER BY b.created_at DESC`,
  [creatorId]
);



    // Check if any bookings exist
    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: 'No bookings found for this creator' });
    }

    // Return all bookings
    res.status(200).json({ bookings: rows });
  } catch (err) {
    console.error('Error fetching bookings by creator ID:', err);
    res.status(500).json({ error: 'Server error' });
  }
};



// Update booking
const updateBooking = async (req, res) => {
  const { id } = req.params;
  const { slot_id, status, payment_status } = req.body;

  if (!id) {
    return res.status(400).json({ message: 'Booking ID is required' });
  }

  try {
    const [result] = await db.query(
      `UPDATE bookings 
       SET slot_id = ?, status = ?, payment_status = ?, updated_at = NOW() 
       WHERE booking_id = ?`,
      [slot_id, status, payment_status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.status(200).json({ message: 'Booking updated successfully' });
  } catch (err) {
    console.error('Error updating booking:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Delete booking
const deleteBooking = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: 'Booking ID is required' });
  }

  try {
    const [result] = await db.query('DELETE FROM bookings WHERE booking_id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.status(200).json({ message: 'Booking deleted successfully' });
  } catch (err) {
    console.error('Error deleting booking:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  createBooking,
  getAllBookings,
  getBookingById,
  getBookingByCreatorId,
  updateBooking,
  deleteBooking,
};
