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
    const [bookings] = await db.query(
      `SELECT 
        b.*, 
        ats.start_time, ats.end_time, ea.day_of_week
       FROM bookings b
       JOIN availability_time_slots ats ON b.slot_id = ats.slot_id
       JOIN experience_availability ea ON ats.availability_id = ea.availability_id`
    );

    res.status(200).json({ bookings });
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
  updateBooking,
  deleteBooking,
};
