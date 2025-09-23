
//bookingStatusCron.js
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const isSameOrAfter = require('dayjs/plugin/isSameOrAfter');
const isSameOrBefore = require('dayjs/plugin/isSameOrBefore');
const db = require('../config/db.js');
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

const updateBookingStatuses = async () => {
  try {
    console.log('🔄 Starting booking status update job...');

    // Get all confirmed bookings that might need status updates
    const [bookings] = await db.query(`
      SELECT 
        b.booking_id,
        b.status,
        b.booking_date,
        b.creator_id,
        b.traveler_id,
        b.traveler_attendance,
        b.last_attendance_prompt,
        -- Get start and end times (prefer slot times, fallback to itinerary item times)
        COALESCE(ats.start_time, ii.start_time) AS start_time,
        COALESCE(ats.end_time, ii.end_time) AS end_time,
        -- Get creator's timezone for accurate time calculations
        u.timezone as creator_timezone,
        e.title as experience_title
      FROM bookings b
      LEFT JOIN availability_time_slots ats ON b.slot_id = ats.slot_id
      LEFT JOIN itinerary_items ii ON b.item_id = ii.item_id
      LEFT JOIN users u ON b.creator_id = u.user_id
      LEFT JOIN experience e ON b.experience_id = e.experience_id
      WHERE b.status IN ('Confirmed', 'Ongoing')
        AND b.booking_date IS NOT NULL
        AND (COALESCE(ats.start_time, ii.start_time) IS NOT NULL)
        AND (COALESCE(ats.end_time, ii.end_time) IS NOT NULL)
      ORDER BY b.booking_date ASC, COALESCE(ats.start_time, ii.start_time) ASC
    `);

    console.log(`📊 Found ${bookings.length} bookings to check`);

    let updatedToOngoing = 0;
    let updatedToCompleted = 0;

    for (const booking of bookings) {
      try {
        const creatorTimezone = booking.creator_timezone || 'UTC';
        
        // Combine booking date and times to get full datetime
        const bookingStartDateTime = dayjs(`${dayjs(booking.booking_date).format('YYYY-MM-DD')} ${booking.start_time}`)
          .tz(creatorTimezone);
        const bookingEndDateTime = dayjs(`${dayjs(booking.booking_date).format('YYYY-MM-DD')} ${booking.end_time}`)
          .tz(creatorTimezone);
        
        // Get current time in creator's timezone
        const nowInCreatorTz = dayjs().tz(creatorTimezone);

        let newStatus = booking.status; // Keep current status by default
        
        // Determine what the status should be
        if (booking.status === 'Confirmed') {
          if (nowInCreatorTz.isSameOrAfter(bookingStartDateTime)) {
            if (nowInCreatorTz.isSameOrBefore(bookingEndDateTime)) {
              newStatus = 'Ongoing';
            } else {
              newStatus = 'Completed';
            }
          }
        } else if (booking.status === 'Ongoing') {
          if (nowInCreatorTz.isAfter(bookingEndDateTime)) {
            newStatus = 'Completed';
          }
        }

        // Update status if it changed
        if (newStatus !== booking.status) {
          await db.query(
            `UPDATE bookings 
             SET status = ?, updated_at = ?
             WHERE booking_id = ?`,
            [newStatus, dayjs().format('YYYY-MM-DD HH:mm:ss'), booking.booking_id]
          );

          if (newStatus === 'Ongoing') updatedToOngoing++;
          if (newStatus === 'Completed') updatedToCompleted++;

          console.log(`✅ Updated booking ${booking.booking_id}: ${booking.status} → ${newStatus}`);
          console.log(`   Experience: ${booking.experience_title}`);
          console.log(`   Time: ${bookingStartDateTime.format('YYYY-MM-DD HH:mm')} - ${bookingEndDateTime.format('HH:mm')}`);

          await sendBookingStatusNotification(booking, newStatus);
        }

        // 🔹 Extra: Attendance re-prompt logic
        if (booking.status === 'Ongoing' && booking.traveler_attendance === 'Waiting') {
          const lastPrompt = booking.last_attendance_prompt ? dayjs(booking.last_attendance_prompt) : null;

          if (!lastPrompt || nowInCreatorTz.diff(lastPrompt, 'minute') >= 15) {
            await notificationService.createNotification({
              user_id: booking.creator_id,
              type: 'attendance_confirmation',
              title: 'Still waiting for traveler?',
              description: `15 minutes have passed. Did the traveler show up for "${booking.experience_title}"?`,
              icon: 'help-circle',
              icon_color: '#F59E0B',
              created_at: nowInCreatorTz.format('YYYY-MM-DD HH:mm:ss'),
              metadata: { booking_id: booking.booking_id }
            });

            await db.query(
              `UPDATE bookings 
               SET last_attendance_prompt = ? 
               WHERE booking_id = ?`,
              [nowInCreatorTz.format('YYYY-MM-DD HH:mm:ss'), booking.booking_id]
            );

            console.log(`⏳ Sent re-prompt for booking ${booking.booking_id}`);
          }
        }

      } catch (bookingError) {
        console.error(`❌ Error processing booking ${booking.booking_id}:`, bookingError);
        continue;
      }
    }

    console.log(`🎯 Booking status update completed:`);
    console.log(`   📈 Updated to Ongoing: ${updatedToOngoing}`);
    console.log(`   ✅ Updated to Completed: ${updatedToCompleted}`);

    return {
      success: true,
      checked: bookings.length,
      updatedToOngoing,
      updatedToCompleted
    };

  } catch (error) {
    console.error('❌ Error in booking status update job:', error);
    throw error;
  }
};


// Optional: Send notifications when booking status changes
const sendBookingStatusNotification = async (booking, newStatus) => {
  try {
    const notificationService = require('../services/notificationService');
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

    if (newStatus === 'Ongoing') {
      // 1. Send start notifications
      await notificationService.createNotification({
        user_id: booking.creator_id,
        type: 'update',
        title: 'Experience Started!',
        description: `Your experience "${booking.experience_title}" is now ongoing.`,
        icon: 'play-circle',
        icon_color: '#10B981',
        created_at: now
      });
      await notificationService.createNotification({
        user_id: booking.traveler_id,
        type: 'update',
        title: 'Experience Started!',
        description: `Your experience "${booking.experience_title}" has begun. Enjoy!`,
        icon: 'play-circle',
        icon_color: '#10B981',
        created_at: now
      });

      // 2. Attendance prompt for creator
      await db.query(
        `UPDATE bookings 
         SET traveler_attendance = 'Waiting',
             last_attendance_prompt = ?
         WHERE booking_id = ?`,
        [now, booking.booking_id]
      );

      await notificationService.createNotification({
        user_id: booking.creator_id,
        type: 'attendance_confirmation',
        title: 'Confirm Traveler Attendance',
        description: `Did the traveler show up for "${booking.experience_title}"?`,
        icon: 'help-circle',
        icon_color: '#F59E0B',
        created_at: now,
        metadata: { booking_id: booking.booking_id }
      });
    }

    if (newStatus === 'Completed') {
      await notificationService.createNotification({
        user_id: booking.creator_id,
        type: 'update',
       title: 'Experience Fulfilled',
description: `The booking for "${booking.experience_title}" is now marked as completed.`,

        icon: 'checkmark-circle',
        icon_color: '#3B82F6',
        created_at: now
      });
      await notificationService.createNotification({
        user_id: booking.traveler_id,
        type: 'update',
        title: 'Experience Completed!',
        description: `Hope you enjoyed "${booking.experience_title}"! Please consider leaving a review.`,
        icon: 'checkmark-circle',
        icon_color: '#3B82F6',
        created_at: now
      });
    }
  } catch (notificationError) {
    console.error('Error sending booking status notification:', notificationError);
  }
};


// Cron job setup (call this every 5-15 minutes)
const setupBookingStatusCron = () => {
  const cron = require('node-cron');
  
  // Run every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    console.log('⏰ Running scheduled booking status update...');
    try {
      await updateBookingStatuses();
    } catch (error) {
      console.error('❌ Cron job failed:', error);
    }
  });

  console.log('📅 Booking status cron job scheduled to run every 10 minutes');
};

// Manual trigger endpoint (useful for testing)
const manualBookingStatusUpdate = async (req, res) => {
  try {
    const result = await updateBookingStatuses();
    res.status(200).json({
      message: 'Booking status update completed',
      ...result
    });
  } catch (error) {
    console.error('Error in manual booking status update:', error);
    res.status(500).json({ error: 'Failed to update booking statuses' });
  }
};

module.exports = {
  updateBookingStatuses,
  setupBookingStatusCron,
  manualBookingStatusUpdate
};