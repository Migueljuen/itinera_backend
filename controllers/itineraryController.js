const dayjs = require('dayjs');  // Import Day.js
const db = require('../config/db.js');
const path = require('path');

const createItinerary = async (req, res) => {
  const { 
    traveler_id, 
    start_date, 
    end_date, 
    title, 
    notes, 
    items,
    accommodation  // Optional accommodation data
  } = req.body;

  // Validate required fields
  if (!traveler_id || !start_date || !end_date || !title || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Traveler ID, start date, end date, title, and items are required' });
  }

  // Begin transaction for atomicity
  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    const startDate = dayjs(start_date);
    const endDate = dayjs(end_date);

    if (startDate.isAfter(endDate)) {
      await connection.rollback();
      return res.status(400).json({ message: 'Start date cannot be after end date' });
    }

    const totalDays = endDate.diff(startDate, 'day') + 1;

    // Validate each item
    for (const item of items) {
      const { experience_id, day_number, start_time, end_time } = item;
      if (!experience_id || !day_number || !start_time || !end_time) {
        await connection.rollback();
        return res.status(400).json({ message: 'Each item must include experience_id, day_number, start_time, and end_time' });
      }

      if (day_number < 1 || day_number > totalDays) {
        await connection.rollback();
        return res.status(400).json({ message: `Invalid day_number: must be between 1 and ${totalDays}` });
      }
    }

    // Validate accommodation data if provided
    if (accommodation) {
      const { 
        name, 
        address, 
        latitude, 
        longitude, 
        check_in, 
        check_out, 
        check_in_time,
        check_out_time,
        booking_link 
      } = accommodation;
      
      // Validate required accommodation fields
      if (!name || !address) {
        await connection.rollback();
        return res.status(400).json({ message: 'Accommodation name and address are required' });
      }

      // Validate check-in and check-out dates if provided
      if (check_in && check_out) {
        const checkInDate = dayjs(check_in);
        const checkOutDate = dayjs(check_out);
        
        if (checkInDate.isAfter(checkOutDate)) {
          await connection.rollback();
          return res.status(400).json({ message: 'Check-in date cannot be after check-out date' });
        }
      }

      // Validate check-in and check-out times if provided (format: HH:MM or HH:MM:SS)
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
      
      if (check_in_time && !timeRegex.test(check_in_time)) {
        await connection.rollback();
        return res.status(400).json({ message: 'Check-in time must be in HH:MM or HH:MM:SS format' });
      }
      
      if (check_out_time && !timeRegex.test(check_out_time)) {
        await connection.rollback();
        return res.status(400).json({ message: 'Check-out time must be in HH:MM or HH:MM:SS format' });
      }

      // Validate latitude and longitude if provided
      if (latitude !== undefined && (latitude < -90 || latitude > 90)) {
        await connection.rollback();
        return res.status(400).json({ message: 'Latitude must be between -90 and 90' });
      }
      
      if (longitude !== undefined && (longitude < -180 || longitude > 180)) {
        await connection.rollback();
        return res.status(400).json({ message: 'Longitude must be between -180 and 180' });
      }
    }

    // Insert into itinerary table
    const [result] = await connection.query(
      `INSERT INTO itinerary (traveler_id, start_date, end_date, title, notes, created_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [traveler_id, start_date, end_date, title, notes || '', dayjs().format('YYYY-MM-DD'), 'upcoming']
    );

    const itinerary_id = result.insertId;

    if (!itinerary_id) {
      await connection.rollback();
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

    await connection.query(
      `INSERT INTO itinerary_items 
        (itinerary_id, experience_id, day_number, start_time, end_time, custom_note, created_at, updated_at)
       VALUES ?`,
      [itemValues]
    );

    // Insert accommodation if provided
    let accommodationData = null;
    if (accommodation) {
      const { 
        name, 
        address, 
        latitude, 
        longitude, 
        check_in, 
        check_out,
        check_in_time,
        check_out_time,
        booking_link 
      } = accommodation;
      
      const [accommodationResult] = await connection.query(
        `INSERT INTO accommodation 
         (itinerary_id, name, address, latitude, longitude, check_in, check_out, check_in_time, check_out_time, booking_link)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itinerary_id,
          name,
          address,
          latitude || null,
          longitude || null,
          check_in || null,
          check_out || null,
          check_in_time || null,
          check_out_time || null,
          booking_link || null
        ]
      );

      // Fetch the created accommodation data for response
      const [createdAccommodation] = await connection.query(
        'SELECT * FROM accommodation WHERE accommodation_id = ?',
        [accommodationResult.insertId]
      );
      
      accommodationData = createdAccommodation[0];
    }

    // Commit the transaction
    await connection.commit();
    connection.release();

    // Prepare response
    const response = {
      message: 'Itinerary created successfully',
      itinerary_id
    };

    // Add accommodation data to response if it was created
    if (accommodationData) {
      response.accommodation = accommodationData;
    }

    res.status(201).json(response);

  } catch (err) {
    await connection.rollback();
    connection.release();
    console.error('Error creating itinerary:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};

// Enhanced status update function that considers activity end times
const updateItineraryStatuses = async () => {
  try {
    const currentDateTime = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const currentDate = dayjs().format('YYYY-MM-DD');
    
    console.log(`🕒 Updating itinerary statuses for: ${currentDateTime}`);
    
    // STEP 1: Update to 'ongoing' - itineraries that have started but not ended
    const [ongoingResult] = await db.query(`
      UPDATE itinerary 
      SET status = 'ongoing' 
      WHERE start_date <= ? 
        AND end_date >= ? 
        AND status = 'upcoming'
    `, [currentDate, currentDate]);
    
    console.log(`✅ Updated ${ongoingResult.affectedRows} itineraries to 'ongoing'`);
    
    // STEP 2: Find itineraries that should be completed based on last activity end time
    const [itinerariesToComplete] = await db.query(`
      SELECT DISTINCT i.itinerary_id, i.title, i.end_date,
             MAX(CONCAT(
               DATE_ADD(i.start_date, INTERVAL (ii.day_number - 1) DAY), 
               ' ', 
               ii.end_time
             )) as last_activity_end_datetime
      FROM itinerary i
      JOIN itinerary_items ii ON i.itinerary_id = ii.itinerary_id
      WHERE i.status IN ('upcoming', 'ongoing')
      GROUP BY i.itinerary_id, i.title, i.end_date
      HAVING last_activity_end_datetime < ?
    `, [currentDateTime]);
    
    console.log(`📋 Found ${itinerariesToComplete.length} itineraries to complete based on activity end times`);
    
    // STEP 3: Update those itineraries to completed
    if (itinerariesToComplete.length > 0) {
      const itineraryIds = itinerariesToComplete.map(item => item.itinerary_id);
      
      await db.query(`
        UPDATE itinerary 
        SET status = 'completed',
            auto_completed_at = NOW()
        WHERE itinerary_id IN (${itineraryIds.map(() => '?').join(',')})
      `, itineraryIds);
      
      // Log details for each completed itinerary
      itinerariesToComplete.forEach(item => {
        console.log(`✅ Completed: "${item.title}" (last activity ended: ${item.last_activity_end_datetime})`);
      });
    }
    
    return {
      ongoingUpdated: ongoingResult.affectedRows,
      completedUpdated: itinerariesToComplete.length,
      completedItineraries: itinerariesToComplete
    };
    
  } catch (error) {
    console.error('❌ Error updating itinerary statuses:', error);
    throw error;
  }
};

// Alternative approach: More precise status calculation for individual itinerary
const calculateItineraryStatus = async (itineraryId) => {
  try {
    const [itineraryData] = await db.query(`
      SELECT i.itinerary_id, i.start_date, i.end_date, i.status,
             MAX(CONCAT(
               DATE_ADD(i.start_date, INTERVAL (ii.day_number - 1) DAY), 
               ' ', 
               ii.end_time
             )) as last_activity_end_datetime,
             MIN(CONCAT(
               DATE_ADD(i.start_date, INTERVAL (ii.day_number - 1) DAY), 
               ' ', 
               ii.start_time
             )) as first_activity_start_datetime
      FROM itinerary i
      LEFT JOIN itinerary_items ii ON i.itinerary_id = ii.itinerary_id
      WHERE i.itinerary_id = ?
      GROUP BY i.itinerary_id, i.start_date, i.end_date, i.status
    `, [itineraryId]);
    
    if (itineraryData.length === 0) {
      return null;
    }
    
    const itinerary = itineraryData[0];
    const now = dayjs();
    
    // If no activities, fall back to date-based logic
    if (!itinerary.last_activity_end_datetime) {
      const startDate = dayjs(itinerary.start_date);
      const endDate = dayjs(itinerary.end_date);
      
      if (now.isBefore(startDate, 'day')) return 'upcoming';
      if (now.isAfter(endDate, 'day')) return 'completed';
      return 'ongoing';
    }
    
    // Activity-based status calculation
    const firstActivityStart = dayjs(itinerary.first_activity_start_datetime);
    const lastActivityEnd = dayjs(itinerary.last_activity_end_datetime);
    
    if (now.isBefore(firstActivityStart)) {
      return 'upcoming';
    } else if (now.isAfter(lastActivityEnd)) {
      return 'completed';
    } else {
      return 'ongoing';
    }
    
  } catch (error) {
    console.error('Error calculating itinerary status:', error);
    throw error;
  }
};

// Enhanced function that gets current activity info for ongoing itineraries
const getCurrentActivityInfo = async (itineraryId) => {
  try {
    const currentDateTime = dayjs().format('YYYY-MM-DD HH:mm:ss');
    
    const [currentActivity] = await db.query(`
      SELECT ii.*, e.title as experience_name,
             CONCAT(
               DATE_ADD(i.start_date, INTERVAL (ii.day_number - 1) DAY), 
               ' ', 
               ii.start_time
             ) as activity_start_datetime,
             CONCAT(
               DATE_ADD(i.start_date, INTERVAL (ii.day_number - 1) DAY), 
               ' ', 
               ii.end_time
             ) as activity_end_datetime
      FROM itinerary i
      JOIN itinerary_items ii ON i.itinerary_id = ii.itinerary_id
      JOIN experience e ON ii.experience_id = e.experience_id
      WHERE i.itinerary_id = ?
        AND CONCAT(
          DATE_ADD(i.start_date, INTERVAL (ii.day_number - 1) DAY), 
          ' ', 
          ii.start_time
        ) <= ?
        AND CONCAT(
          DATE_ADD(i.start_date, INTERVAL (ii.day_number - 1) DAY), 
          ' ', 
          ii.end_time
        ) >= ?
      ORDER BY ii.day_number, ii.start_time
      LIMIT 1
    `, [itineraryId, currentDateTime, currentDateTime]);
    
    if (currentActivity.length > 0) {
      return {
        type: 'current',
        activity: currentActivity[0],
        message: `Currently: ${currentActivity[0].experience_name}`
      };
    }
    
    // If no current activity, find the next one
    const [nextActivity] = await db.query(`
      SELECT ii.*, e.title as experience_name,
             CONCAT(
               DATE_ADD(i.start_date, INTERVAL (ii.day_number - 1) DAY), 
               ' ', 
               ii.start_time
             ) as activity_start_datetime
      FROM itinerary i
      JOIN itinerary_items ii ON i.itinerary_id = ii.itinerary_id
      JOIN experience e ON ii.experience_id = e.experience_id
      WHERE i.itinerary_id = ?
        AND CONCAT(
          DATE_ADD(i.start_date, INTERVAL (ii.day_number - 1) DAY), 
          ' ', 
          ii.start_time
        ) > ?
      ORDER BY ii.day_number, ii.start_time
      LIMIT 1
    `, [itineraryId, currentDateTime]);
    
    if (nextActivity.length > 0) {
      const timeUntilNext = dayjs(nextActivity[0].activity_start_datetime).diff(dayjs(), 'minute');
      return {
        type: 'upcoming',
        activity: nextActivity[0],
        message: `Next: ${nextActivity[0].experience_name} in ${timeUntilNext} minutes`
      };
    }
    
    return {
      type: 'completed',
      activity: null,
      message: 'All activities completed'
    };
    
  } catch (error) {
    console.error('Error getting current activity info:', error);
    throw error;
  }
};

// Real-time status check for a specific itinerary (useful for detail screen)
const getItineraryWithRealTimeStatus = async (itineraryId) => {
  try {
    // Get basic itinerary info
    const [itineraryInfo] = await db.query(`
      SELECT * FROM itinerary WHERE itinerary_id = ?
    `, [itineraryId]);
    
    if (itineraryInfo.length === 0) return null;
    
    const itinerary = itineraryInfo[0];
    
    // Calculate real-time status
    const realTimeStatus = await calculateItineraryStatus(itineraryId);
    
    // Get current activity info if ongoing
    let currentActivityInfo = null;
    if (realTimeStatus === 'ongoing') {
      currentActivityInfo = await getCurrentActivityInfo(itineraryId);
    }
    
    // Update status in database if different
    if (realTimeStatus !== itinerary.status) {
      await db.query(`
        UPDATE itinerary 
        SET status = ?,
            auto_completed_at = CASE WHEN ? = 'completed' THEN NOW() ELSE auto_completed_at END
        WHERE itinerary_id = ?
      `, [realTimeStatus, realTimeStatus, itineraryId]);
      
      console.log(`🔄 Updated itinerary ${itineraryId} status: ${itinerary.status} → ${realTimeStatus}`);
    }
    
    return {
      ...itinerary,
      status: realTimeStatus,
      currentActivityInfo
    };
    
  } catch (error) {
    console.error('Error getting real-time itinerary status:', error);
    throw error;
  }
};

// Your enhanced function with status updates
const getItineraryByTraveler = async (req, res) => {
  const { traveler_id } = req.params;

  if (!traveler_id) {
    return res.status(400).json({ message: 'Traveler ID is required' });
  }

  try {
    // 🆕 STEP 1: Update statuses first with activity-based logic
    await updateItineraryStatuses();

    // STEP 2: Fetch itineraries with updated statuses and improved ordering
    const [itineraries] = await db.query(`
      SELECT * FROM itinerary 
      WHERE traveler_id = ? 
      ORDER BY 
        CASE 
          WHEN status = 'ongoing' THEN 1
          WHEN status = 'upcoming' THEN 2
          WHEN status = 'completed' THEN 3
        END,
        start_date ASC
    `, [traveler_id]);

    if (itineraries.length === 0) {
      return res.status(404).json({ message: 'No itinerary found for this traveler' });
    }

    // STEP 3: Fetch items for each itinerary (your existing logic, kept intact)
    const detailedItineraries = await Promise.all(
      itineraries.map(async (itinerary) => {
        // Format the dates (your existing logic)
        const formattedItinerary = {
          ...itinerary,
          start_date: dayjs(itinerary.start_date).format('YYYY-MM-DD'),
          end_date: dayjs(itinerary.end_date).format('YYYY-MM-DD'),
          created_at: dayjs(itinerary.created_at).format('YYYY-MM-DD HH:mm:ss')
        };

        // Get items for the current itinerary with experience details and destination (your existing logic)
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
             e.description AS experience_description,
             e.price,
             e.unit,
             d.name AS destination_name,
             d.city AS destination_city
           FROM itinerary_items ii
           LEFT JOIN experience e ON ii.experience_id = e.experience_id
           LEFT JOIN destination d ON e.destination_id = d.destination_id
           WHERE ii.itinerary_id = ?
           ORDER BY ii.day_number, ii.start_time`,
          [itinerary.itinerary_id]
        );

        // Fetch images for each experience in the items (your existing logic, kept intact)
        const itemsWithImages = await Promise.all(
          items.map(async (item) => {
            if (item.experience_id) {
              try {
                // Fetch images for this experience
                const [imageRows] = await db.query(
                  `SELECT image_url FROM experience_images WHERE experience_id = ?`,
                  [item.experience_id]
                );
                
                // Convert file system paths to URLs (your existing logic)
                const images = imageRows.map(img => {
                  // Extract just the filename from the absolute path
                  const filename = path.basename(img.image_url);
                  // Return a relative URL path that your server can handle
                  return `/uploads/experiences/${filename}`;
                });

                return {
                  ...item,
                  images: images,
                  // Add the first image as primary image for easy access
                  primary_image: images.length > 0 ? images[0] : null
                };
              } catch (imageError) {
                console.error(`Error fetching images for experience ${item.experience_id}:`, imageError);
                return {
                  ...item,
                  images: [],
                  primary_image: null
                };
              }
            } else {
              return {
                ...item,
                images: [],
                primary_image: null
              };
            }
          })
        );

        return {
          ...formattedItinerary,
          items: itemsWithImages
        };
      })
    );

    // 🆕 STEP 4: Enhanced response with status update info
    res.status(200).json({ 
      message: 'Itineraries retrieved successfully',
      itineraries: detailedItineraries 
    });

  } catch (err) {
    console.error('Error in getItineraryByTraveler:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};

// Enhanced getItineraryById with real-time status updates
const getItineraryById = async (req, res) => {
  const { itinerary_id } = req.params;

  if (!itinerary_id) {
    return res.status(400).json({ message: 'Itinerary ID is required' });
  }

  try {
    // 🆕 Get itinerary with real-time status check
    const itineraryWithStatus = await getItineraryWithRealTimeStatus(itinerary_id);
    
    if (!itineraryWithStatus) {
      return res.status(404).json({ message: 'Itinerary not found' });
    }

    // Format the dates
    const formattedItinerary = {
      ...itineraryWithStatus,
      start_date: dayjs(itineraryWithStatus.start_date).format('YYYY-MM-DD'),
      end_date: dayjs(itineraryWithStatus.end_date).format('YYYY-MM-DD'),
      created_at: dayjs(itineraryWithStatus.created_at).format('YYYY-MM-DD HH:mm:ss')
    };

    // Get items for the itinerary with experience details and destination
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
         e.description AS experience_description,
         e.price,
         e.unit,
         d.name AS destination_name,
         d.city AS destination_city
       FROM itinerary_items ii
       LEFT JOIN experience e ON ii.experience_id = e.experience_id
       LEFT JOIN destination d ON e.destination_id = d.destination_id
       WHERE ii.itinerary_id = ?
       ORDER BY ii.day_number, ii.start_time`,
      [itinerary_id]
    );

    // Fetch images for each experience in the items
    const itemsWithImages = await Promise.all(
      items.map(async (item) => {
        if (item.experience_id) {
          try {
            // Fetch images for this experience
            const [imageRows] = await db.query(
              `SELECT image_url FROM experience_images WHERE experience_id = ?`,
              [item.experience_id]
            );
            
            // Convert file system paths to URLs
            const images = imageRows.map(img => {
              // Extract just the filename from the absolute path
              const filename = path.basename(img.image_url);
              // Return a relative URL path that your server can handle
              return `/uploads/experiences/${filename}`;
            });

            return {
              ...item,
              images: images,
              // Add the first image as primary image for easy access
              primary_image: images.length > 0 ? images[0] : null
            };
          } catch (imageError) {
            console.error(`Error fetching images for experience ${item.experience_id}:`, imageError);
            return {
              ...item,
              images: [],
              primary_image: null
            };
          }
        } else {
          return {
            ...item,
            images: [],
            primary_image: null
          };
        }
      })
    );

    const detailedItinerary = {
      ...formattedItinerary,
      items: itemsWithImages
    };

    // 🆕 Include current activity info in response
    const response = { 
      itinerary: detailedItinerary
    };
    
    if (itineraryWithStatus.currentActivityInfo) {
      response.currentActivity = itineraryWithStatus.currentActivityInfo;
    }

    res.status(200).json(response);
  } catch (err) {
    console.error('Error in getItineraryById:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
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
  updateItineraryStatuses,
  calculateItineraryStatus,
  getCurrentActivityInfo,
  getItineraryWithRealTimeStatus,
  getItineraryById,
  getItineraryItems,
  updateItinerary,
  deleteItinerary,
};