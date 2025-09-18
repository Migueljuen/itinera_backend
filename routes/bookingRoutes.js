const express = require('express');
const router = express.Router();
const { createBooking,
  getAllBookings,
  getBookingById,
  getBookingByCreatorId,
  updateBooking,
  deleteBooking, } = require('../controllers/bookingController.js');


// CRUD Routes
router.post("/create", createBooking);       // Create booking
router.get("/", getAllBookings); 
router.get("/creator/:creatorId", getBookingByCreatorId);       // Get all bookings
router.get("/:id", getBookingById); 


// Get booking by ID
router.put("/:id", updateBooking);     // Update booking
router.delete("/:id", deleteBooking);  // Delete booking

module.exports = router;
