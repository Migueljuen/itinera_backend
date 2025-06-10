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
      const { name, address, latitude, longitude, check_in, check_out, booking_link } = accommodation;
      
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
      const { name, address, latitude, longitude, check_in, check_out, booking_link } = accommodation;
      
      const [accommodationResult] = await connection.query(
        `INSERT INTO accommodation 
         (itinerary_id, name, address, latitude, longitude, check_in, check_out, booking_link)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itinerary_id,
          name,
          address,
          latitude || null,
          longitude || null,
          check_in || null,
          check_out || null,
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




const getItineraryByTraveler = async (req, res) => {
  const { traveler_id } = req.params;

  if (!traveler_id) {
    return res.status(400).json({ message: 'Traveler ID is required' });
  }

  try {
    const [itineraries] = await db.query(
      'SELECT * FROM itinerary WHERE traveler_id = ?',
      [traveler_id]
    );

    if (itineraries.length === 0) {
      return res.status(404).json({ message: 'No itinerary found for this traveler' });
    }

    // Fetch items for each itinerary
    const detailedItineraries = await Promise.all(
      itineraries.map(async (itinerary) => {
        // Format the dates
        const formattedItinerary = {
          ...itinerary,
          start_date: dayjs(itinerary.start_date).format('YYYY-MM-DD'),
          end_date: dayjs(itinerary.end_date).format('YYYY-MM-DD'),
          created_at: dayjs(itinerary.created_at).format('YYYY-MM-DD HH:mm:ss')
        };

        // Get items for the current itinerary with experience details and destination
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
             d.name AS destination_name,
             d.city AS destination_city
           FROM itinerary_items ii
           LEFT JOIN experience e ON ii.experience_id = e.experience_id
           LEFT JOIN destination d ON e.destination_id = d.destination_id
           WHERE ii.itinerary_id = ?
           ORDER BY ii.day_number, ii.start_time`,
          [itinerary.itinerary_id]
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

        return {
          ...formattedItinerary,
          items: itemsWithImages
        };
      })
    );

    res.status(200).json({ itineraries: detailedItineraries });
  } catch (err) {
    console.error('Error in getItineraryByTraveler:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};

const getItineraryById = async (req, res) => {
  const { itinerary_id } = req.params;

  if (!itinerary_id) {
    return res.status(400).json({ message: 'Itinerary ID is required' });
  }

  try {
    // Get the specific itinerary
    const [itineraries] = await db.query(
      'SELECT * FROM itinerary WHERE itinerary_id = ?',
      [itinerary_id]
    );

    if (itineraries.length === 0) {
      return res.status(404).json({ message: 'Itinerary not found' });
    }

    const itinerary = itineraries[0];

    // Format the dates
    const formattedItinerary = {
      ...itinerary,
      start_date: dayjs(itinerary.start_date).format('YYYY-MM-DD'),
      end_date: dayjs(itinerary.end_date).format('YYYY-MM-DD'),
      created_at: dayjs(itinerary.created_at).format('YYYY-MM-DD HH:mm:ss')
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

    res.status(200).json({ itinerary: detailedItinerary });
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
  getItineraryById,
  getItineraryItems,
  updateItinerary,
  deleteItinerary,
  
};
