const express = require('express');
const router = express.Router();
const { createBooking,
  getAllBookings,
  getBookingById,
  getBookingByCreatorId,
  updateTravelerAttendance,
  updateBooking,
  deleteBooking,
  getUpcomingBookings, } = require('../controllers/bookingController.js');


// CRUD Routes
router.post("/create", createBooking);               // Create booking
router.get("/", getAllBookings); 

// More specific routes must come BEFORE generic :id
router.get("/creator/upcoming/:creatorId", getUpcomingBookings);   
router.get("/creator/:creatorId", getBookingByCreatorId);  



router.put("/:bookingId/attendance/:notificationId", updateTravelerAttendance);

  
router.get("/:id", getBookingById);                  // Get booking by ID

router.put("/:id", updateBooking);                   // Update booking
router.delete("/:id", deleteBooking);                // Delete booking




module.exports = router;
