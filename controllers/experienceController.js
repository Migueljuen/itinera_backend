require('dotenv').config();
const { CITY_CENTERS, calculateDistanceFromCityCenter } = require('../utils/cityUtils');

const db = require('../config/db.js');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const dayjs = require('dayjs');
const util = require('util');
const unlinkAsync = util.promisify(fs.unlink);



const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.resolve('uploads/experiences')); // Correct relative to project root
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});


const createExperience = async (req, res) => {
  // Extract destination and experience data from request body
  const { 
    // Experience data
    creator_id, title, description, price, unit, availability, tags, status,

    // Destination data
    destination_name, city, destination_description, latitude, longitude,

    // Option to use existing destination
    destination_id,
    travel_companions // Array of companions
  } = req.body;

  // Get uploaded files if any
  const files = req.files;

  // Begin transaction for atomicity
  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    // Validate experience required fields
    if (!creator_id || !price || !unit) {
      await connection.rollback();
      return res.status(400).json({ message: 'All experience fields are required' });
    }

    // Validate 'unit' value
    const validUnits = ['Entry', 'Hour', 'Day', 'Package'];
    if (!validUnits.includes(unit)) {
      await connection.rollback();
      return res.status(400).json({ message: 'Invalid unit type' });
    }

    // Validate 'status' value if provided
    const validStatuses = ['draft', 'inactive', 'active'];
    const experienceStatus = status || 'draft';
    if (!validStatuses.includes(experienceStatus)) {
      await connection.rollback();
      return res.status(400).json({ message: 'Invalid status value' });
    }

    // Check if creator_id exists and has role 'Creator'
    const [user] = await connection.query('SELECT role FROM users WHERE user_id = ?', [creator_id]);
    if (user.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Creator not found' });
    }
    if (user[0].role !== 'Creator') {
      await connection.rollback();
      return res.status(403).json({ message: 'User must have role "Creator" to create an experience' });
    }

    // Parse and validate travel companions
    let parsedCompanions = [];
    try {
      parsedCompanions = typeof travel_companions === 'string' 
        ? JSON.parse(travel_companions) 
        : travel_companions;
    } catch (e) {
      await connection.rollback();
      return res.status(400).json({ message: 'Invalid travel_companions format' });
    }

    // Validate companion types
    const validCompanions = ['Solo', 'Partner', 'Family', 'Friends', 'Group', 'Any'];
    if (!Array.isArray(parsedCompanions) || parsedCompanions.length === 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'At least one travel companion type is required' });
    }

    const invalidCompanions = parsedCompanions.filter(c => !validCompanions.includes(c));
    if (invalidCompanions.length > 0) {
      await connection.rollback();
      return res.status(400).json({ 
        message: 'Invalid travel companion types', 
        invalid: invalidCompanions 
      });
    }

    // Parse and validate tags
    console.log("Tags before parsing:", tags);
    let parsedTags;
    try {
      parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
    } catch (e) {
      await connection.rollback();
      return res.status(400).json({ message: 'Invalid tags format' });
    }

    if (!parsedTags || !Array.isArray(parsedTags) || parsedTags.length === 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'At least one tag is required' });
    }

    // Verify that all tag IDs exist
    const [existingTags] = await connection.query(
      'SELECT tag_id FROM tags WHERE tag_id IN (?)',
      [parsedTags]
    );
    if (existingTags.length !== parsedTags.length) {
      await connection.rollback();
      return res.status(400).json({ message: 'One or more tag IDs do not exist' });
    }

    // Handle destination - either use existing one or create new one
    let finalDestinationId;

    if (destination_id) {
      const [destinationCheck] = await connection.query(
        'SELECT destination_id FROM destination WHERE destination_id = ?',
        [destination_id]
      );
      if (destinationCheck.length === 0) {
        await connection.rollback();
        return res.status(404).json({ message: 'Specified destination does not exist' });
      }
      finalDestinationId = destination_id;
    } else {
      if (!destination_name || !city || !destination_description || !latitude || !longitude) {
        await connection.rollback();
        return res.status(400).json({ message: 'All destination fields are required when creating a new destination' });
      }

      // Check for existing destination first
      const [existingDestination] = await connection.query(
        'SELECT destination_id FROM destination WHERE name = ? AND city = ?', 
        [destination_name, city]
      );
      
      if (existingDestination.length > 0) {
        finalDestinationId = existingDestination[0].destination_id;
        console.log(`✅ Using existing destination: ${destination_name} (ID: ${finalDestinationId})`);
      } else {
        // Calculate distance from city center
        let distanceFromCenter = null;
        
        const cityCenter = CITY_CENTERS[city];
        if (cityCenter) {
          distanceFromCenter = calculateDistanceFromCityCenter(
            parseFloat(latitude),
            parseFloat(longitude),
            cityCenter.lat,
            cityCenter.lng
          );
          
          distanceFromCenter = Math.round(distanceFromCenter * 100) / 100;
          console.log(`✅ Calculated distance for ${destination_name}: ${distanceFromCenter}km from ${city} center`);
        } else {
          console.warn(`⚠️ Warning: No city center coordinates found for "${city}". Distance will be NULL.`);
        }

        // Insert destination
        const [newDestination] = await connection.query(
          'INSERT INTO destination (name, city, description, latitude, longitude, distance_from_city_center) VALUES (?, ?, ?, ?, ?, ?)',
          [destination_name, city, destination_description, latitude, longitude, distanceFromCenter]
        );
        
        finalDestinationId = newDestination.insertId;
        console.log(`✅ New destination created: ${destination_name} (ID: ${finalDestinationId}, Distance: ${distanceFromCenter}km)`);
      }
    }

    // Insert new experience with JSON travel_companions
    const [result] = await connection.query(
      `INSERT INTO experience 
      (creator_id, destination_id, title, description, price, unit, status, travel_companions, created_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURDATE())`,
      [creator_id, finalDestinationId, title || null, description || null, price, unit, experienceStatus, JSON.stringify(parsedCompanions)]
    );

    const experience_id = result.insertId;

    // Parse and validate availability
    if (!availability || (typeof availability === 'string' && !availability.trim()) || (Array.isArray(availability) && availability.length === 0)) {
      await connection.rollback();
      return res.status(400).json({ message: 'Availability information is required' });
    }

    let parsedAvailability;
    try {
      parsedAvailability = typeof availability === 'string' ? JSON.parse(availability) : availability;
    } catch (e) {
      await connection.rollback();
      return res.status(400).json({ message: 'Invalid availability format' });
    }

    // Validate each availability entry
    const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    // Insert availability and time slots
    for (const dayAvailability of parsedAvailability) {
      const { day_of_week, time_slots } = dayAvailability;

      if (!validDays.includes(day_of_week) || !Array.isArray(time_slots) || time_slots.length === 0) {
        await connection.rollback();
        return res.status(400).json({ message: 'Each availability entry must have a valid day and time_slots array' });
      }

      // Insert into experience_availability
      const [availabilityResult] = await connection.execute(
        `INSERT INTO experience_availability (experience_id, day_of_week) VALUES (?, ?)`,
        [experience_id, day_of_week]
      );
      const availability_id = availabilityResult.insertId;

      // Insert all associated time slots
      for (const slot of time_slots) {
        const { start_time, end_time } = slot;

        if (!start_time || !end_time) {
          await connection.rollback();
          return res.status(400).json({ message: 'Each time slot must have a start_time and end_time' });
        }

        await connection.execute(
          `INSERT INTO availability_time_slots (availability_id, start_time, end_time) VALUES (?, ?, ?)`,
          [availability_id, start_time, end_time]
        );
      }
    }

    // Insert tag associations
    const tagValues = parsedTags.map(tag_id => [experience_id, tag_id]);
    await connection.query(
      `INSERT INTO experience_tags (experience_id, tag_id) VALUES ?`,
      [tagValues]
    );

    // Handle image uploads if any
    if (files && files.length > 0) {
      const imageValues = files.map(file => {
        const filename = file.path.split('\\').pop().split('/').pop();
        const webPath = `uploads/experiences/${filename}`;
        return [experience_id, webPath];
      });

      console.log('Web paths to be saved:', imageValues);
      
      await connection.query(
        'INSERT INTO experience_images (experience_id, image_url) VALUES ?',
        [imageValues]
      );
    }

    // Commit the transaction
    await connection.commit();
    connection.release();

    // Fetch all created data for response
    const [destinationInfo] = await db.query(
      'SELECT * FROM destination WHERE destination_id = ?',
      [finalDestinationId]
    );
    
    const [availabilityRecords] = await db.query(
      'SELECT * FROM experience_availability WHERE experience_id = ?',
      [experience_id]
    );
    
    // Fetch time slots for each availability
    const processedAvailability = [];
    for (const avail of availabilityRecords) {
      const [timeSlots] = await db.query(
        'SELECT * FROM availability_time_slots WHERE availability_id = ?',
        [avail.availability_id]
      );
      
      processedAvailability.push({
        ...avail,
        time_slots: timeSlots
      });
    }

    // Fetch tags
    const [tagRecords] = await db.query(
      'SELECT t.tag_id, t.name FROM tags t JOIN experience_tags et ON t.tag_id = et.tag_id WHERE et.experience_id = ?',
      [experience_id]
    );

    // Fetch images
    const [imageRecords] = files && files.length > 0 ? await db.query(
      'SELECT * FROM experience_images WHERE experience_id = ?',
      [experience_id]
    ) : [[]];

    res.status(201).json({ 
      message: 'Experience and destination created successfully',
      experience_id,
      destination_id: finalDestinationId,
      destination: destinationInfo[0],
      availability: processedAvailability,
      tags: tagRecords,
      images: imageRecords || [],
      travel_companions: parsedCompanions, // Return as array
      status: experienceStatus
    });
  } catch (err) {
    await connection.rollback();
    connection.release();
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};


const createMultipleExperiences = async (req, res) => {
  const experiences = req.body; // Array of experience objects

  // Validate that request body is an array
  if (!Array.isArray(experiences) || experiences.length === 0) {
    return res.status(400).json({ message: 'Request body must be a non-empty array of experiences' });
  }

  // Get uploaded files if any (for bulk upload, files would need special handling)
  const files = req.files || [];

  const results = [];
  const errors = [];

  // Begin transaction for atomicity across all experiences
  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    for (let i = 0; i < experiences.length; i++) {
      const experienceData = experiences[i];
      
      // Extract data for current experience
      const { 
        creator_id, title, description, price, unit, availability, tags, status,
        destination_name, city, destination_description, latitude, longitude,
        destination_id,
        travel_companions
      } = experienceData;

      try {
        // Validate experience required fields
        if (!creator_id || !price || !unit) {
          throw new Error(`Experience ${i + 1}: All experience fields are required`);
        }

        // Validate 'unit' value
        const validUnits = ['Entry', 'Hour', 'Day', 'Package'];
        if (!validUnits.includes(unit)) {
          throw new Error(`Experience ${i + 1}: Invalid unit type`);
        }

        // Validate 'status' value if provided
        const validStatuses = ['draft', 'inactive', 'active'];
        const experienceStatus = status || 'draft';
        if (!validStatuses.includes(experienceStatus)) {
          throw new Error(`Experience ${i + 1}: Invalid status value`);
        }

        // Check if creator_id exists and has role 'Creator'
        const [user] = await connection.query('SELECT role FROM users WHERE user_id = ?', [creator_id]);
        if (user.length === 0) {
          throw new Error(`Experience ${i + 1}: Creator not found`);
        }
        if (user[0].role !== 'Creator') {
          throw new Error(`Experience ${i + 1}: User must have role "Creator" to create an experience`);
        }

        // Parse and validate travel companions
        let parsedCompanions = [];
        try {
          parsedCompanions = Array.isArray(travel_companions) 
            ? travel_companions 
            : JSON.parse(travel_companions);
        } catch (e) {
          throw new Error(`Experience ${i + 1}: Invalid travel_companions format`);
        }

        // Validate companion types
        const validCompanions = ['Solo', 'Partner', 'Family', 'Friends', 'Group', 'Any'];
        if (!Array.isArray(parsedCompanions) || parsedCompanions.length === 0) {
          throw new Error(`Experience ${i + 1}: At least one travel companion type is required`);
        }

        const invalidCompanions = parsedCompanions.filter(c => !validCompanions.includes(c));
        if (invalidCompanions.length > 0) {
          throw new Error(`Experience ${i + 1}: Invalid travel companion types: ${invalidCompanions.join(', ')}`);
        }

        // Parse and validate tags
        let parsedTags;
        try {
          parsedTags = Array.isArray(tags) ? tags : JSON.parse(tags);
        } catch (e) {
          throw new Error(`Experience ${i + 1}: Invalid tags format`);
        }

        if (!parsedTags || !Array.isArray(parsedTags) || parsedTags.length === 0) {
          throw new Error(`Experience ${i + 1}: At least one tag is required`);
        }

        // Verify that all tag IDs exist
        const [existingTags] = await connection.query(
          'SELECT tag_id FROM tags WHERE tag_id IN (?)',
          [parsedTags]
        );
        if (existingTags.length !== parsedTags.length) {
          throw new Error(`Experience ${i + 1}: One or more tag IDs do not exist`);
        }

        // Handle destination - either use existing one or create new one
        let finalDestinationId;

        if (destination_id) {
          const [destinationCheck] = await connection.query(
            'SELECT destination_id FROM destination WHERE destination_id = ?',
            [destination_id]
          );
          if (destinationCheck.length === 0) {
            throw new Error(`Experience ${i + 1}: Specified destination does not exist`);
          }
          finalDestinationId = destination_id;
        } else {
          if (!destination_name || !city || !destination_description || !latitude || !longitude) {
            throw new Error(`Experience ${i + 1}: All destination fields are required when creating a new destination`);
          }

          // Check for existing destination first
          const [existingDestination] = await connection.query(
            'SELECT destination_id FROM destination WHERE name = ? AND city = ?', 
            [destination_name, city]
          );
          
          if (existingDestination.length > 0) {
            finalDestinationId = existingDestination[0].destination_id;
            console.log(`✅ Experience ${i + 1}: Using existing destination: ${destination_name} (ID: ${finalDestinationId})`);
          } else {
            // Calculate distance from city center
            let distanceFromCenter = null;
            
            const cityCenter = CITY_CENTERS[city];
            if (cityCenter) {
              distanceFromCenter = calculateDistanceFromCityCenter(
                parseFloat(latitude),
                parseFloat(longitude),
                cityCenter.lat,
                cityCenter.lng
              );
              
              distanceFromCenter = Math.round(distanceFromCenter * 100) / 100;
              console.log(`✅ Experience ${i + 1}: Calculated distance for ${destination_name}: ${distanceFromCenter}km from ${city} center`);
            } else {
              console.warn(`⚠️ Experience ${i + 1}: Warning: No city center coordinates found for "${city}". Distance will be NULL.`);
            }

            // Insert destination
            const [newDestination] = await connection.query(
              'INSERT INTO destination (name, city, description, latitude, longitude, distance_from_city_center) VALUES (?, ?, ?, ?, ?, ?)',
              [destination_name, city, destination_description, latitude, longitude, distanceFromCenter]
            );
            
            finalDestinationId = newDestination.insertId;
            console.log(`✅ Experience ${i + 1}: New destination created: ${destination_name} (ID: ${finalDestinationId}, Distance: ${distanceFromCenter}km)`);
          }
        }

        // Insert new experience with JSON travel_companions
        const [result] = await connection.query(
          `INSERT INTO experience 
          (creator_id, destination_id, title, description, price, unit, status, travel_companions, created_at) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURDATE())`,
          [creator_id, finalDestinationId, title || null, description || null, price, unit, experienceStatus, JSON.stringify(parsedCompanions)]
        );

        const experience_id = result.insertId;

        // Parse and validate availability
        if (!availability || (typeof availability === 'string' && !availability.trim()) || (Array.isArray(availability) && availability.length === 0)) {
          throw new Error(`Experience ${i + 1}: Availability information is required`);
        }

        let parsedAvailability;
        try {
          parsedAvailability = Array.isArray(availability) ? availability : JSON.parse(availability);
        } catch (e) {
          throw new Error(`Experience ${i + 1}: Invalid availability format`);
        }

        // Validate each availability entry
        const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

        // Insert availability and time slots
        for (const dayAvailability of parsedAvailability) {
          const { day_of_week, time_slots } = dayAvailability;

          if (!validDays.includes(day_of_week) || !Array.isArray(time_slots) || time_slots.length === 0) {
            throw new Error(`Experience ${i + 1}: Each availability entry must have a valid day and time_slots array`);
          }

          // Insert into experience_availability
          const [availabilityResult] = await connection.execute(
            `INSERT INTO experience_availability (experience_id, day_of_week) VALUES (?, ?)`,
            [experience_id, day_of_week]
          );
          const availability_id = availabilityResult.insertId;

          // Insert all associated time slots
          for (const slot of time_slots) {
            const { start_time, end_time } = slot;

            if (!start_time || !end_time) {
              throw new Error(`Experience ${i + 1}: Each time slot must have a start_time and end_time`);
            }

            await connection.execute(
              `INSERT INTO availability_time_slots (availability_id, start_time, end_time) VALUES (?, ?, ?)`,
              [availability_id, start_time, end_time]
            );
          }
        }

        // Insert tag associations
        const tagValues = parsedTags.map(tag_id => [experience_id, tag_id]);
        await connection.query(
          `INSERT INTO experience_tags (experience_id, tag_id) VALUES ?`,
          [tagValues]
        );

        // For bulk upload, file handling would need to be enhanced
        // Currently skipping image upload for bulk operations
        
        results.push({
          index: i + 1,
          experience_id,
          destination_id: finalDestinationId,
          title: title || `Experience ${i + 1}`,
          status: 'success',
          message: 'Experience created successfully'
        });

        console.log(`✅ Experience ${i + 1} (${title}) created successfully with ID: ${experience_id}`);

      } catch (experienceError) {
        console.error(`❌ Error creating experience ${i + 1}:`, experienceError.message);
        errors.push({
          index: i + 1,
          title: experienceData.title || `Experience ${i + 1}`,
          error: experienceError.message
        });
        // Continue processing other experiences rather than stopping
      }
    }

    // Commit the transaction if we have any successful results
    if (results.length > 0) {
      await connection.commit();
      console.log(`✅ Bulk operation completed. ${results.length} experiences created successfully.`);
    } else {
      await connection.rollback();
      console.log(`❌ Bulk operation failed. No experiences were created.`);
    }
    
    connection.release();

    // Return comprehensive results
    const response = {
      message: `Bulk operation completed: ${results.length} successes, ${errors.length} errors`,
      summary: {
        total_attempted: experiences.length,
        successful: results.length,
        failed: errors.length
      },
      results,
      errors
    };

    // Return appropriate status code
    if (errors.length === 0) {
      res.status(201).json(response);
    } else if (results.length === 0) {
      res.status(400).json(response);
    } else {
      res.status(207).json(response); // 207 Multi-Status for partial success
    }

  } catch (err) {
    await connection.rollback();
    connection.release();
    console.error('❌ Bulk operation failed:', err);
    res.status(500).json({ 
      error: 'Bulk operation failed', 
      details: err.message,
      summary: {
        total_attempted: experiences.length,
        successful: results.length,
        failed: experiences.length - results.length
      },
      results,
      errors
    });
  }
};


const getAllExperience = async (req, res) => {
  try {
    const {
      location,
      start_date,
      end_date,
      tags,
      budget,
      explore_time,
      travel_companion, // Single companion filter (backward compatibility)
      travel_companions, // Multiple companions filter (new)
      travel_distance, // Add this parameter
      start_time,
      end_time,
      itinerary_id, // Add this to get accommodation info
      accommodation_id // Or pass this directly
    } = req.query;

    console.log('=== API REQUEST DEBUG ===');
    console.log('Query params:', req.query);

    // Normalize city name helper function
    const normalizeCityName = (city) => {
      if (!city) return city;
      
      // Replace underscores with spaces
      let normalized = city.replace(/_/g, ' ');
      
      // Capitalize each word
      normalized = normalized.replace(/\b\w/g, char => char.toUpperCase());
      
      // Handle common variations
      if (!normalized.toLowerCase().includes('city')) {
        normalized = normalized + ' City';
      }
      
      return normalized;
    };

    // Get accommodation details if filtering for itinerary
    let accommodationDetails = null;
    if (itinerary_id || accommodation_id) {
      try {
        let accommodationQuery;
        let accommodationParams;
        
        if (itinerary_id) {
          accommodationQuery = `
            SELECT a.check_in_time, a.check_out_time, i.start_date, i.end_date
            FROM itinerary i
            LEFT JOIN accommodation a ON i.accommodation_id = a.id
            WHERE i.itinerary_id = ?
          `;
          accommodationParams = [itinerary_id];
        } else {
          accommodationQuery = `
            SELECT check_in_time, check_out_time
            FROM accommodation
            WHERE id = ?
          `;
          accommodationParams = [accommodation_id];
        }
        
        const [accommodationResult] = await db.query(accommodationQuery, accommodationParams);
        if (accommodationResult.length > 0) {
          accommodationDetails = accommodationResult[0];
          console.log('=== ACCOMMODATION DEBUG ===');
          console.log('Accommodation details:', accommodationDetails);
        }
      } catch (accommodationError) {
        console.log('Error fetching accommodation:', accommodationError);
      }
    }

    let tripDayNames = [];
    let tripDates = []; // Store actual dates for accommodation filtering
    
    if (start_date && end_date) {
      const [startYear, startMonth, startDay] = start_date.split('-');
      const startDate = new Date(parseInt(startYear), parseInt(startMonth) - 1, parseInt(startDay));
      const endDate = new Date(end_date);
      const tripDaysOfWeek = [];

      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        tripDaysOfWeek.push(currentDate.getDay());
        // Store actual dates for accommodation filtering
        tripDates.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }

      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      tripDayNames = [...new Set(tripDaysOfWeek.map(dayNum => dayNames[dayNum]))];
    }

    console.log('=== FILTERING DEBUG ===');
    console.log('Start date:', start_date);
    console.log('End date:', end_date);
    console.log('Trip day names:', tripDayNames);
    console.log('Trip dates:', tripDates);

    // FIXED: Case-insensitive city center lookup
    let selectedCityCenter = null;
    if (location && location.trim()) {
      // Normalize the city name first
      const normalizedCity = normalizeCityName(location.trim());
      console.log(`Normalizing city name: "${location}" -> "${normalizedCity}"`);
      
      // Try exact match with normalized name
      selectedCityCenter = CITY_CENTERS[normalizedCity];
      
      if (!selectedCityCenter) {
        // Try various cases if exact match fails
        const cityVariations = [
          normalizedCity,
          normalizedCity.toLowerCase(),
          normalizedCity.toUpperCase(),
          location.trim(), // Original input
          location.trim().replace(/_/g, ' '), // Just replace underscores
        ];
        
        for (const variation of cityVariations) {
          if (CITY_CENTERS[variation]) {
            selectedCityCenter = CITY_CENTERS[variation];
            console.log(`✅ Found city center using variation: "${variation}" for input: "${location}"`);
            break;
          }
        }
      } else {
        console.log(`✅ Found city center for "${normalizedCity}":`, selectedCityCenter);
      }
      
      if (!selectedCityCenter) {
        console.warn(`⚠️ No city center coordinates found for "${location}". Available cities:`, Object.keys(CITY_CENTERS).slice(0, 10));
        console.warn(`⚠️ Falling back to city-based filtering.`);
      }
    }

    let query = `
      SELECT 
        e.experience_id AS id,
        e.title,
        e.description,
        e.price,
        e.unit,
        d.name AS destination_name,
        d.city AS location,
        d.latitude,
        d.longitude,
        d.distance_from_city_center,
        e.travel_companion,
        e.travel_companions, 
        GROUP_CONCAT(DISTINCT t.name) AS tags
      FROM experience e
      JOIN destination d ON e.destination_id = d.destination_id
      LEFT JOIN experience_tags et ON e.experience_id = et.experience_id
      LEFT JOIN tags t ON et.tag_id = t.tag_id
    `;

    const params = [];
    const conditions = [];

    // Build the query structure first, then add parameters in the right order
    let hasDateFilter = start_date && end_date && tripDayNames.length > 0;
    
    // Always use LEFT JOIN for availability data
    query += `
      LEFT JOIN experience_availability a ON e.experience_id = a.experience_id
      LEFT JOIN availability_time_slots ts ON a.availability_id = ts.availability_id
    `;

    // Location filter with travel distance support
    if (selectedCityCenter && travel_distance) {
      // CROSS-CITY DISTANCE-BASED FILTERING
      const distanceMap = {
        'nearby': 10,    // ≤10km from selected city center
        'moderate': 40,  // ≤40km from selected city center
        'far': null      // All distances from selected city center
      };
      
      const maxDistance = distanceMap[travel_distance.toLowerCase()];
      
      if (maxDistance !== null && maxDistance !== undefined) {
        // Calculate distance from selected city center for each destination
        conditions.push(`(
          d.distance_from_city_center IS NULL OR
          (6371 * acos(
            cos(radians(?)) * cos(radians(d.latitude)) * 
            cos(radians(d.longitude) - radians(?)) + 
            sin(radians(?)) * sin(radians(d.latitude))
          )) <= ?
        )`);
        
        params.push(
          selectedCityCenter.lat,   // Selected city center latitude
          selectedCityCenter.lng,   // Selected city center longitude  
          selectedCityCenter.lat,   // Selected city center latitude (for sin calculation)
          maxDistance               // Maximum distance
        );
        
        console.log(`🌍 Applied cross-city distance filter: ${travel_distance} (≤${maxDistance}km from ${location} center)`);
        console.log(`📍 Using ${location} center coordinates: ${selectedCityCenter.lat}, ${selectedCityCenter.lng}`);
        
      } else if (travel_distance.toLowerCase() === 'far') {
        // For "far": No distance restriction
        console.log(`🌍 Applied cross-city distance filter: ${travel_distance} (no distance limit from ${location} center)`);
        console.log(`📍 Reference point: ${location} center coordinates: ${selectedCityCenter.lat}, ${selectedCityCenter.lng}`);
      }
      
    } else if (location && location.trim()) {
      // FALLBACK: Traditional city-based filtering
      const cityPattern = location.trim().toLowerCase().replace(/_/g, '%');
      conditions.push(`(LOWER(d.city) LIKE ? OR LOWER(REPLACE(d.city, ' ', '_')) LIKE ?)`);
      params.push(`%${cityPattern}%`, `%${location.trim().toLowerCase()}%`);
      console.log(`🏙️ Applied traditional city-based filter: ${location} (administrative boundaries)`);
      
      if (travel_distance) {
        console.warn(`⚠️ Travel distance preference "${travel_distance}" ignored due to missing city center coordinates`);
      }
    }

    // Travel companion filter - Updated to support both old and new format
    if (travel_companions) {
      // New format: filter by multiple companions
      const companionList = typeof travel_companions === 'string' 
        ? travel_companions.split(',').map(c => c.trim())
        : travel_companions;
      
      // Build condition for JSON_CONTAINS
      const jsonConditions = companionList.map(() => 
        'JSON_CONTAINS(e.travel_companions, JSON_QUOTE(?), "$")'
      ).join(' OR ');
      
      conditions.push(`(${jsonConditions})`);
      params.push(...companionList);
      
    } else if (travel_companion) {
      // Backward compatibility: check both old ENUM and new JSON field
      conditions.push(`(
        LOWER(e.travel_companion) = LOWER(?) 
        OR JSON_CONTAINS(e.travel_companions, JSON_QUOTE(?), "$")
      )`);
      params.push(travel_companion.trim(), travel_companion.trim());
    }

    // Date filter with accommodation consideration
    if (hasDateFilter) {
      conditions.push(`e.experience_id IN (
        SELECT DISTINCT ea.experience_id 
        FROM experience_availability ea 
        WHERE ea.day_of_week IN (${tripDayNames.map(() => '?').join(',')})
      )`);
      params.push(...tripDayNames);
    }

    // Time filters (including accommodation constraints)
    const timeConditions = [];
    
    // Original explore_time filter
    if (explore_time) {
      switch (explore_time.toLowerCase()) {
        case 'daytime':
          timeConditions.push('HOUR(ts.start_time) < 18');
          break;
        case 'nighttime':
          timeConditions.push('HOUR(ts.start_time) >= 16');
          break;
      }
    }

    // Accommodation time constraints
    if (accommodationDetails && accommodationDetails.check_in_time && accommodationDetails.check_out_time) {
      if (start_date && end_date) {
        const checkInTime = accommodationDetails.check_in_time;
        const checkOutTime = accommodationDetails.check_out_time;
        
        timeConditions.push(`
          (
            (DATE(?) = ? AND ts.start_time >= ?) OR  -- Check-in day
            (DATE(?) = ? AND ts.end_time <= ?) OR    -- Check-out day  
            (DATE(?) > ? AND DATE(?) < ?)            -- Days in between
          )
        `);
        
        params.push(
          start_date, start_date, checkInTime,  // Check-in day
          end_date, end_date, checkOutTime,     // Check-out day
          start_date, start_date, end_date      // Days in between
        );
      }
    }

    // Combine time conditions
    if (timeConditions.length > 0) {
      conditions.push(`(${timeConditions.join(' AND ')})`);
    }

    // Budget filter
    if (budget) {
      switch (budget.toLowerCase()) {
        case 'free':
          conditions.push('e.price = 0');
          break;
        case 'budget-friendly':
          conditions.push('e.price <= 500');
          break;
        case 'mid-range':
          conditions.push('e.price < 2000');
          break;
        case 'premium':
          conditions.push('e.price > 2000');
          break;
      }
    }

    // Tags filter
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : tags.split(',');
      const cleanedTags = tagArray.map(tag => tag.trim());
      if (cleanedTags.length > 0) {
        conditions.push(`e.experience_id IN (
          SELECT DISTINCT et2.experience_id 
          FROM experience_tags et2 
          JOIN tags t2 ON et2.tag_id = t2.tag_id 
          WHERE t2.name IN (${cleanedTags.map(() => '?').join(',')})
        )`);
        params.push(...cleanedTags);
      }
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` GROUP BY e.experience_id`;

    // Updated ordering logic for cross-city approach
    if (selectedCityCenter && travel_distance) {
      if (travel_distance.toLowerCase() === 'nearby') {
        // Nearby: Order by actual distance from selected city center (closest first)
        query += ` ORDER BY 
          (6371 * acos(
            cos(radians(${selectedCityCenter.lat})) * cos(radians(d.latitude)) * 
            cos(radians(d.longitude) - radians(${selectedCityCenter.lng})) + 
            sin(radians(${selectedCityCenter.lat})) * sin(radians(d.latitude))
          )) ASC, 
          e.created_at DESC`;
      } else if (travel_distance.toLowerCase() === 'moderate') {
        // Moderate: Balanced ordering
        query += ` ORDER BY 
          CASE 
            WHEN d.distance_from_city_center IS NULL THEN 1
            WHEN (6371 * acos(
              cos(radians(${selectedCityCenter.lat})) * cos(radians(d.latitude)) * 
              cos(radians(d.longitude) - radians(${selectedCityCenter.lng})) + 
              sin(radians(${selectedCityCenter.lat})) * sin(radians(d.latitude))
            )) <= 10 THEN 2
            ELSE 3
          END,
          e.created_at DESC`;
      } else {
        // Far: Default ordering
        query += ` ORDER BY e.created_at DESC`;
      }
    } else {
      // Fallback ordering
      query += ` ORDER BY e.created_at DESC`;
    }

    const [experiences] = await db.query(query, params);

    // Get images
    const [images] = await db.query(`
      SELECT experience_id, image_url
      FROM experience_images
    `);

    // Get availability with accommodation filtering
    const experienceIds = experiences.map(exp => exp.id);
    let availabilityResults = [];
    
    if (experienceIds.length > 0) {
      let availabilityQuery = `
        SELECT 
          a.experience_id,
          a.availability_id,
          a.day_of_week,
          ts.slot_id,
          ts.start_time,
          ts.end_time
        FROM experience_availability a
        JOIN availability_time_slots ts ON a.availability_id = ts.availability_id
        WHERE a.experience_id IN (?)
      `;
      
      let availabilityParams = [experienceIds];
      
      // Apply the same day filter if we have trip days
      if (hasDateFilter) {
        const dayPlaceholders = tripDayNames.map(() => '?').join(',');
        availabilityQuery += ` AND a.day_of_week IN (${dayPlaceholders})`;
        availabilityParams.push(...tripDayNames);
      }
      
      // Apply accommodation time filtering to availability
      if (accommodationDetails && accommodationDetails.check_in_time && accommodationDetails.check_out_time) {
        availabilityQuery += `
          AND (
            ts.start_time >= ? OR  -- After check-in time
            ts.end_time <= ?       -- Before check-out time
          )
        `;
        availabilityParams.push(accommodationDetails.check_in_time, accommodationDetails.check_out_time);
      }
      
      availabilityQuery += ` ORDER BY a.experience_id, a.day_of_week, ts.start_time`;
      
      const [results] = await db.query(availabilityQuery, availabilityParams);
      availabilityResults = results;
    }

    // Process images
    const imageMap = {};
    images.forEach(img => {
      if (!imageMap[img.experience_id]) {
        imageMap[img.experience_id] = [];
      }
      let webPath = img.image_url;
      if (webPath.includes(':\\') || webPath.includes('\\')) {
        const filename = webPath.split('\\').pop();
        webPath = `uploads/experience/${filename}`;
      }
      imageMap[img.experience_id].push(webPath);
    });

    // Process availability
    const availabilityMap = {};
    availabilityResults.forEach(avail => {
      if (!availabilityMap[avail.experience_id]) {
        availabilityMap[avail.experience_id] = [];
      }

      let dayAvailability = availabilityMap[avail.experience_id].find(
        day => day.availability_id === avail.availability_id
      );

      if (!dayAvailability) {
        dayAvailability = {
          availability_id: avail.availability_id,
          experience_id: avail.experience_id,
          day_of_week: avail.day_of_week,
          time_slots: []
        };
        availabilityMap[avail.experience_id].push(dayAvailability);
      }

      if (avail.slot_id) {
        dayAvailability.time_slots.push({
          slot_id: avail.slot_id,
          availability_id: avail.availability_id,
          start_time: avail.start_time,
          end_time: avail.end_time
        });
      }
    });

    // Finalize experience data with proper travel companion handling and distance calculations
    experiences.forEach(exp => {
      exp.tags = exp.tags ? exp.tags.split(',') : [];
      exp.images = imageMap[exp.id] || [];
      exp.availability = availabilityMap[exp.id] || [];

      // Handle travel companions - MySQL returns JSON as already parsed
      let companions = [];
      
      // Check if travel_companions exists
      if (exp.travel_companions !== null && exp.travel_companions !== undefined) {
        // MySQL returns JSON columns as already parsed values
        if (Array.isArray(exp.travel_companions)) {
          companions = exp.travel_companions;
        } else if (typeof exp.travel_companions === 'string') {
          // Just in case it's still a string, try to parse it
          try {
            companions = JSON.parse(exp.travel_companions);
          } catch (e) {
            console.error('Error parsing travel_companions for experience', exp.id, e);
            companions = [exp.travel_companions]; // Treat as single value
          }
        } else {
          // If it's neither array nor string, log for debugging
          console.warn(`Unexpected travel_companions type for experience ${exp.id}:`, typeof exp.travel_companions, exp.travel_companions);
        }
      }
      
      // Fall back to old ENUM field if companions is empty
      if (companions.length === 0 && exp.travel_companion) {
        companions = [exp.travel_companion];
      }
      
      // Set both formats in response for backward compatibility
      exp.travel_companions = companions; // Array format (new)
      // Keep exp.travel_companion as is for old clients

      // Calculate actual distance from selected city center if available
      let actualDistanceFromSelectedCity = null;
      if (selectedCityCenter && exp.latitude && exp.longitude) {
        actualDistanceFromSelectedCity = calculateDistanceFromCityCenter(
          parseFloat(exp.latitude),
          parseFloat(exp.longitude),
          selectedCityCenter.lat,
          selectedCityCenter.lng
        );
        actualDistanceFromSelectedCity = Math.round(actualDistanceFromSelectedCity * 100) / 100;
      }

      // Add distance information
      exp.distance_from_city_center = exp.distance_from_city_center; // Original distance
      exp.distance_from_selected_city = actualDistanceFromSelectedCity; // Distance from search city

      // Add accommodation constraint info for frontend
      if (accommodationDetails) {
        exp.accommodation_constraints = {
          check_in_time: accommodationDetails.check_in_time,
          check_out_time: accommodationDetails.check_out_time,
          filtered_by_accommodation: true
        };
      }

      if (exp.price === 0) {
        exp.budget_category = 'Free';
      } else if (exp.price <= 500) {
        exp.budget_category = 'Budget-friendly';
      } else if (exp.price <= 2000) {
        exp.budget_category = 'Mid-range';
      } else {
        exp.budget_category = 'Premium';
      }
    });

    // Debug: Show distance distribution from selected city center
    if (travel_distance && selectedCityCenter) {
      const distances = experiences
        .map(exp => exp.distance_from_selected_city)
        .filter(d => d !== null)
        .sort((a, b) => a - b);
      
      console.log(`📊 Distance distribution from ${location} center:`, {
        min: distances[0] || 'N/A',
        max: distances[distances.length - 1] || 'N/A',
        count_with_distance: distances.length,
        count_with_null: experiences.length - distances.length,
        cities_included: [...new Set(experiences.map(exp => exp.location))]
      });
    }

    res.status(200).json(experiences);

  } catch (error) {
    console.error('Error fetching experiences:', error);
    res.status(500).json({ message: 'Failed to fetch experiences' });
  }
};
const getExperienceTitlesAndTags = async (req, res) => {
  try {
    // Optional query: location or tags
    const { location, tags } = req.query;

    let query = `
      SELECT 
        e.title,
        e.experience_id,
        GROUP_CONCAT(DISTINCT t.name) AS tags
      FROM experience e
      LEFT JOIN experience_tags et ON e.experience_id = et.experience_id
      LEFT JOIN tags t ON et.tag_id = t.tag_id
      LEFT JOIN destination d ON e.destination_id = d.destination_id
    `;

    const conditions = [];
    const params = [];

    // Filter by location if provided
    if (location) {
      conditions.push(`LOWER(d.city) LIKE ?`);
      params.push(`%${location.toLowerCase()}%`);
    }

    // Filter by tags if provided
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : tags.split(',');
      const placeholders = tagArray.map(() => '?').join(',');
      conditions.push(`
        e.experience_id IN (
          SELECT et2.experience_id
          FROM experience_tags et2
          JOIN tags t2 ON et2.tag_id = t2.tag_id
          WHERE t2.name IN (${placeholders})
        )
      `);
      params.push(...tagArray.map(tag => tag.trim()));
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` GROUP BY e.experience_id ORDER BY e.title ASC`;

    const [experiences] = await db.query(query, params);

    // Convert tags from comma-separated string to array
    const result = experiences.map(exp => ({
      experience_id: exp.experience_id,
      title: exp.title,
      tags: exp.tags ? exp.tags.split(',') : []
    }));

    res.status(200).json(result);

  } catch (error) {
    console.error('Error fetching experience titles and tags:', error);
    res.status(500).json({ message: 'Failed to fetch experiences' });
  }
};


const getExperienceAvailability = async (req, res) => {
  const experienceId = req.params.id;
  const { day } = req.query;

  console.log('=== AVAILABILITY API DEBUG ===');
  console.log('Experience ID:', experienceId);
  console.log('Day parameter:', day);
  console.log('All query params:', req.query);
  console.log('Request URL:', req.url);
  console.log('Request method:', req.method);

  try {
    // First, check if the experience exists
    const [experienceCheck] = await db.query(
      'SELECT experience_id FROM experience WHERE experience_id = ?',
      [experienceId]
    );

    console.log('Experience check result:', experienceCheck);

    if (experienceCheck.length === 0) {
      return res.status(404).json({ error: 'Experience not found' });
    }

    // Get availability data with time slots - using exact schema names
    let query = `SELECT 
      ea.availability_id,
      ea.experience_id,
      ea.day_of_week,
      ats.slot_id,
      ats.start_time,
      ats.end_time
     FROM experience_availability ea
     JOIN availability_time_slots ats ON ea.availability_id = ats.availability_id
     WHERE ea.experience_id = ?`;
    
    const params = [experienceId];
    
    // Add day filter only if day parameter is provided
    if (day) {
      query += ` AND ea.day_of_week = ?`;
      params.push(day);
    }
    
    query += ` ORDER BY ea.day_of_week, ats.start_time`;
    
    console.log('Final query:', query);
    console.log('Query params:', params);
    
    const [availabilityResults] = await db.query(query, params);
    
    console.log('Raw availability results:', availabilityResults);

    if (availabilityResults.length === 0) {
      const message = day 
        ? `No availability found for experience ${experienceId} on ${day}` 
        : `No availability found for experience ${experienceId}`;
      return res.status(404).json({ error: message });
    }

    // Process the results to match the structure from getAllExperience
    const availability = [];
    const availabilityMap = {};

    availabilityResults.forEach(result => {
      if (!availabilityMap[result.availability_id]) {
        availabilityMap[result.availability_id] = {
          availability_id: result.availability_id,
          experience_id: result.experience_id,
          day_of_week: result.day_of_week,
          time_slots: []
        };
        availability.push(availabilityMap[result.availability_id]);
      }

      availabilityMap[result.availability_id].time_slots.push({
        slot_id: result.slot_id,
        availability_id: result.availability_id,
        start_time: result.start_time,
        end_time: result.end_time
      });
    });

    console.log('Processed availability:', availability);

    res.json({ 
      experience_id: parseInt(experienceId),
      requested_day: day || 'all',
      availability: availability 
    });

  } catch (error) {
    console.error('Error fetching availability:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

const getAvailableTimeSlots = async (req, res) => {
  const experience_id = req.params.id;
  const { date, itinerary_id, item_id } = req.query;

  if (!experience_id || !date || !itinerary_id || !item_id) {
    return res.status(400).json({ message: 'Missing required parameters' });
  }

  const dayOfWeek = dayjs(date).format('dddd');

  try {
    // Step 1: Get all available time slots for the experience on that day
    const [availableSlots] = await db.query(`
      SELECT ats.start_time, ats.end_time
      FROM experience_availability ea
      JOIN availability_time_slots ats ON ea.availability_id = ats.availability_id
      WHERE ea.experience_id = ? AND ea.day_of_week = ?
    `, [experience_id, dayOfWeek]);

    // Step 2: Get existing itinerary items for the same day (excluding current item)
    const [bookedSlots] = await db.query(`
      SELECT ii.start_time, ii.end_time
      FROM itinerary_items ii
      JOIN itinerary i ON ii.itinerary_id = i.itinerary_id
      WHERE ii.itinerary_id = ? 
        AND TIMESTAMPDIFF(DAY, i.start_date, ?) + 1 = ii.day_number
     AND ii.item_id != ?

    `, [itinerary_id, date, item_id]);

    // Step 3: Filter out conflicting time slots
    const conflictFree = availableSlots.filter(slot => {
      return !bookedSlots.some(booked =>
        (slot.start_time < booked.end_time && slot.end_time > booked.start_time)
      );
    });

    res.status(200).json({ available_slots: conflictFree });
  } catch (error) {
    console.error('Error fetching available slots:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};



const getExperienceById = async (req, res) => {
  const { id } = req.params;
  const user_id = req.user?.userId; // Optional user ID from auth middleware

  try {
    // Fetch experience and complete destination data
    const [rows] = await db.query(
      `SELECT 
        e.*,
        d.destination_id,
        d.name AS destination_name,
        d.city AS destination_city,
        d.longitude AS destination_longitude,
        d.latitude AS destination_latitude,
        d.description AS destination_description
       FROM experience e
       JOIN destination d ON e.destination_id = d.destination_id
       WHERE e.experience_id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Experience not found' });
    }

    const experience = rows[0];

    // Parse travel_companions JSON field
    let companions = [];
    
    // MySQL returns JSON columns as already parsed values
    if (experience.travel_companions !== null && experience.travel_companions !== undefined) {
      if (Array.isArray(experience.travel_companions)) {
        companions = experience.travel_companions;
      } else if (typeof experience.travel_companions === 'string') {
        // Just in case it's still a string, try to parse it
        try {
          companions = JSON.parse(experience.travel_companions);
        } catch (e) {
          console.error('Error parsing travel_companions for experience', id, e);
          companions = [experience.travel_companions];
        }
      }
    }
    
    // Fall back to old ENUM field if JSON is empty
    if (companions.length === 0 && experience.travel_companion) {
      companions = [experience.travel_companion];
    }
    
    // Set the parsed array
    experience.travel_companions = companions;

    // Fetch tags associated with the experience
    const [tagRows] = await db.query(
      `SELECT t.name FROM tags t
       JOIN experience_tags et ON t.tag_id = et.tag_id
       WHERE et.experience_id = ?`,
      [id]
    );
    experience.tags = tagRows.map(tag => tag.name);

    // Fetch images associated with the experience
    const [imageRows] = await db.query(
      `SELECT image_url FROM experience_images WHERE experience_id = ?`,
      [id]
    );
    
    // Convert file system paths to URLs
    experience.images = imageRows.map(img => {
      // Extract just the filename from the absolute path
      const filename = path.basename(img.image_url);
      // Return a relative URL path that your server can handle
      return `/uploads/experiences/${filename}`;
    });

    // Fetch availability data
    const [availabilityRows] = await db.query(
      `SELECT 
        a.availability_id,
        a.day_of_week,
        ts.slot_id,
        ts.start_time,
        ts.end_time
       FROM experience_availability a
       LEFT JOIN availability_time_slots ts ON a.availability_id = ts.availability_id
       WHERE a.experience_id = ?
       ORDER BY a.day_of_week, ts.start_time`,
      [id]
    );

    // Process availability data into structured format
    const availabilityMap = {};
    
    availabilityRows.forEach(row => {
      if (!availabilityMap[row.availability_id]) {
        availabilityMap[row.availability_id] = {
          availability_id: row.availability_id,
          day_of_week: row.day_of_week,
          time_slots: []
        };
      }
      
      if (row.slot_id) {
        availabilityMap[row.availability_id].time_slots.push({
          slot_id: row.slot_id,
          start_time: row.start_time,
          end_time: row.end_time
        });
      }
    });
    
    experience.availability = Object.values(availabilityMap);

    // Check if experience is saved by current user (if authenticated)
    if (user_id) {
      const [savedCheck] = await db.query(
        'SELECT id FROM saved_experiences WHERE user_id = ? AND experience_id = ?',
        [user_id, id]
      );
      experience.is_saved = savedCheck.length > 0;
    } else {
      experience.is_saved = false;
    }

    // Structure the destination data as a nested object
    experience.destination = {
      destination_id: experience.destination_id,
      name: experience.destination_name,
      city: experience.destination_city,
      longitude: experience.destination_longitude,
      latitude: experience.destination_latitude,
      description: experience.destination_description
    };

    // Remove the flattened destination fields from the root level
    delete experience.destination_id;
    delete experience.destination_name;
    delete experience.destination_city;
    delete experience.destination_longitude;
    delete experience.destination_latitude;
    delete experience.destination_description;

    res.json(experience);
  } catch (err) {
    console.error('Error fetching experience:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};

const getActiveExperience = async (req, res) => {
  try {
    // 1. Fetch active experiences with destination info and tags
    const [experiences] = await db.query(`
      SELECT 
        e.experience_id AS id,
        e.title,
        e.description,
        e.price,
        e.unit,
        d.name AS destination_name,
        d.city AS location,
        GROUP_CONCAT(t.name) AS tags
      FROM experience e
      JOIN destination d ON e.destination_id = d.destination_id
      LEFT JOIN experience_tags et ON e.experience_id = et.experience_id
      LEFT JOIN tags t ON et.tag_id = t.tag_id
      WHERE e.status = 'active'
      GROUP BY e.experience_id
    `);

    // 2. Fetch all images
    const [images] = await db.query(`
      SELECT 
        experience_id,
        image_url
      FROM experience_images
    `);

    // 3. Map images by experience_id
    const imageMap = {};
    images.forEach(img => {
      if (!imageMap[img.experience_id]) {
        imageMap[img.experience_id] = [];
      }

      let webPath = img.image_url;
      if (webPath.includes(':\\') || webPath.includes('\\')) {
        const filename = webPath.split('\\').pop();
        webPath = `uploads/experiences/${filename}`;
      }

      imageMap[img.experience_id].push(webPath);
    });

    // 4. Attach tags and images
    experiences.forEach(exp => {
      exp.tags = exp.tags ? exp.tags.split(',') : [];
      exp.images = imageMap[exp.id] || [];
    });

    // 5. Return the result
    res.status(200).json(experiences);

  } catch (error) {
    console.error('Error fetching active experiences:', error);
    res.status(500).json({ message: 'Failed to fetch active experiences' });
  }
};

const getExperienceByUserID = async (req, res) => {
  const { user_id } = req.params;

  try {
    // Fetch all experiences created by this user
    const [experiences] = await db.query(
      `SELECT e.*, d.name AS destination_name
       FROM experience e
       JOIN destination d ON e.destination_id = d.destination_id
       WHERE e.creator_id = ?`,
      [user_id]
    );

    if (experiences.length === 0) {
      return res.status(404).json({ message: 'No experiences found for this user' });
    }

    const experienceIds = experiences.map(exp => exp.experience_id);

    // Fetch tags
    const [tagRows] = await db.query(
      `SELECT et.experience_id, t.name 
       FROM tags t
       JOIN experience_tags et ON t.tag_id = et.tag_id
       WHERE et.experience_id IN (?)`,
      [experienceIds]
    );

    // Fetch images
    const [imageRows] = await db.query(
      `SELECT experience_id, image_url 
       FROM experience_images 
       WHERE experience_id IN (?)`,
      [experienceIds]
    );

    // Fetch availability + time slots
    const [availabilityRows] = await db.query(
      `SELECT 
         a.experience_id,
         a.availability_id,
         a.day_of_week,
         ts.slot_id,
         ts.start_time,
         ts.end_time
       FROM experience_availability a
       LEFT JOIN availability_time_slots ts 
         ON a.availability_id = ts.availability_id
       WHERE a.experience_id IN (?)
       ORDER BY a.experience_id, a.day_of_week, ts.start_time`,
      [experienceIds]
    );

    // Process into maps for easier merging
    const tagMap = {};
    tagRows.forEach(row => {
      if (!tagMap[row.experience_id]) tagMap[row.experience_id] = [];
      tagMap[row.experience_id].push(row.name);
    });

    const imageMap = {};
    imageRows.forEach(row => {
      if (!imageMap[row.experience_id]) imageMap[row.experience_id] = [];
      let webPath = row.image_url;
      if (webPath.includes(':\\') || webPath.includes('\\')) {
        const filename = path.basename(webPath);
        webPath = `/uploads/experiences/${filename}`;
      }
      imageMap[row.experience_id].push(webPath);
    });

    const availabilityMap = {};
    availabilityRows.forEach(avail => {
      if (!availabilityMap[avail.experience_id]) {
        availabilityMap[avail.experience_id] = [];
      }

      let dayAvailability = availabilityMap[avail.experience_id].find(
        day => day.availability_id === avail.availability_id
      );

      if (!dayAvailability) {
        dayAvailability = {
          availability_id: avail.availability_id,
          experience_id: avail.experience_id,
          day_of_week: avail.day_of_week,
          time_slots: []
        };
        availabilityMap[avail.experience_id].push(dayAvailability);
      }

      if (avail.slot_id) {
        dayAvailability.time_slots.push({
          slot_id: avail.slot_id,
          availability_id: avail.availability_id,
          start_time: avail.start_time,
          end_time: avail.end_time
        });
      }
    });

    // Merge data into experiences
    experiences.forEach(exp => {
      exp.tags = tagMap[exp.experience_id] || [];
      exp.images = imageMap[exp.experience_id] || [];
      exp.availability = availabilityMap[exp.experience_id] || [];
    });

    res.json(experiences);
  } catch (err) {
    console.error('Error fetching experiences by user ID:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};


const updateExperience = async (req, res) => {
  const { experience_id } = req.params;
  const { 
    // Experience data
    title, description, price, unit, status, 
    travel_companion, // Keep for backward compatibility
    travel_companions, // New array field
    
    // Destination data (for creating new or switching)
    destination_name, city, destination_description, latitude, longitude,
    destination_id,
    
    // Arrays
    availability, tags,
    
    // Images to delete
    images_to_delete
  } = req.body;

  // Get uploaded files if any
  const files = req.files;

  // Begin transaction
  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    // Check if experience exists and get current data
    const [existingExperience] = await connection.query(
      'SELECT * FROM experience WHERE experience_id = ?',
      [experience_id]
    );

    if (existingExperience.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Experience not found' });
    }

    const currentExperience = existingExperience[0];

    // Check if user has permission to update (must be the creator)
    if (req.user && req.user.user_id !== currentExperience.creator_id) {
      await connection.rollback();
      return res.status(403).json({ message: 'You do not have permission to update this experience' });
    }

    // Build dynamic update query for experience table
    const updateFields = [];
    const updateValues = [];

    if (title !== undefined) {
      updateFields.push('title = ?');
      updateValues.push(title);
    }

    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }

    if (price !== undefined) {
      updateFields.push('price = ?');
      updateValues.push(price);
    }

    if (unit !== undefined) {
      // Validate unit
      const validUnits = ['Entry', 'Hour', 'Day', 'Package'];
      if (!validUnits.includes(unit)) {
        await connection.rollback();
        return res.status(400).json({ message: 'Invalid unit type' });
      }
      updateFields.push('unit = ?');
      updateValues.push(unit);
    }

    if (status !== undefined) {
      // Validate status
      const validStatuses = ['draft', 'inactive', 'active'];
      if (!validStatuses.includes(status)) {
        await connection.rollback();
        return res.status(400).json({ message: 'Invalid status value' });
      }
      updateFields.push('status = ?');
      updateValues.push(status);
    }

    // Handle travel companions update (new array format)
    if (travel_companions !== undefined) {
      let parsedCompanions;
      try {
        parsedCompanions = typeof travel_companions === 'string' 
          ? JSON.parse(travel_companions) 
          : travel_companions;
      } catch (e) {
        await connection.rollback();
        return res.status(400).json({ message: 'Invalid travel_companions format' });
      }

      // Validate companion types
      const validCompanions = ['Solo', 'Partner', 'Family', 'Friends', 'Group', 'Any'];
      if (!Array.isArray(parsedCompanions)) {
        await connection.rollback();
        return res.status(400).json({ message: 'travel_companions must be an array' });
      }

      const invalidCompanions = parsedCompanions.filter(c => !validCompanions.includes(c));
      if (invalidCompanions.length > 0) {
        await connection.rollback();
        return res.status(400).json({ 
          message: 'Invalid travel companion types', 
          invalid: invalidCompanions 
        });
      }

      updateFields.push('travel_companions = ?');
      updateValues.push(JSON.stringify(parsedCompanions));

      // Also update the old ENUM field with the first value for backward compatibility
      if (parsedCompanions.length > 0) {
        updateFields.push('travel_companion = ?');
        updateValues.push(parsedCompanions[0]);
      }
    } else if (travel_companion !== undefined) {
      // Backward compatibility: if only single travel_companion is provided
      updateFields.push('travel_companion = ?');
      updateValues.push(travel_companion);
      
      // Also update the new JSON field
      updateFields.push('travel_companions = ?');
      updateValues.push(JSON.stringify([travel_companion]));
    }

    // Handle destination update
    if (destination_id !== undefined || (destination_name && city && destination_description && latitude && longitude)) {
      let finalDestinationId;

      if (destination_id) {
        // Use existing destination
        const [destinationCheck] = await connection.query(
          'SELECT destination_id FROM destination WHERE destination_id = ?',
          [destination_id]
        );
        if (destinationCheck.length === 0) {
          await connection.rollback();
          return res.status(404).json({ message: 'Specified destination does not exist' });
        }
        finalDestinationId = destination_id;
      } else if (destination_name && city && destination_description && latitude && longitude) {
        // Create new destination or use existing
        const [existingDestination] = await connection.query(
          'SELECT destination_id FROM destination WHERE name = ? AND city = ?', 
          [destination_name, city]
        );
        
        if (existingDestination.length > 0) {
          finalDestinationId = existingDestination[0].destination_id;
        } else {
          // Calculate distance from city center (assuming you have CITY_CENTERS and calculateDistanceFromCityCenter)
          let distanceFromCenter = null;
          
          if (typeof CITY_CENTERS !== 'undefined' && CITY_CENTERS[city]) {
            const cityCenter = CITY_CENTERS[city];
            distanceFromCenter = calculateDistanceFromCityCenter(
              parseFloat(latitude),
              parseFloat(longitude),
              cityCenter.lat,
              cityCenter.lng
            );
            distanceFromCenter = Math.round(distanceFromCenter * 100) / 100;
          }

          const [newDestination] = await connection.query(
            'INSERT INTO destination (name, city, description, latitude, longitude, distance_from_city_center) VALUES (?, ?, ?, ?, ?, ?)',
            [destination_name, city, destination_description, latitude, longitude, distanceFromCenter]
          );
          
          finalDestinationId = newDestination.insertId;
        }
      }

      if (finalDestinationId) {
        updateFields.push('destination_id = ?');
        updateValues.push(finalDestinationId);
      }
    }

    // Update experience if there are fields to update
    if (updateFields.length > 0) {
      updateValues.push(experience_id);
      await connection.query(
        `UPDATE experience SET ${updateFields.join(', ')} WHERE experience_id = ?`,
        updateValues
      );
    }

    // Handle availability update
    if (availability !== undefined) {
      let parsedAvailability;
      try {
        parsedAvailability = typeof availability === 'string' ? JSON.parse(availability) : availability;
      } catch (e) {
        await connection.rollback();
        return res.status(400).json({ message: 'Invalid availability format' });
      }

      if (Array.isArray(parsedAvailability) && parsedAvailability.length > 0) {
        // Delete existing availability and time slots
        const [existingAvailability] = await connection.query(
          'SELECT availability_id FROM experience_availability WHERE experience_id = ?',
          [experience_id]
        );

        for (const avail of existingAvailability) {
          await connection.query(
            'DELETE FROM availability_time_slots WHERE availability_id = ?',
            [avail.availability_id]
          );
        }

        await connection.query(
          'DELETE FROM experience_availability WHERE experience_id = ?',
          [experience_id]
        );

        // Insert new availability
        const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

        for (const dayAvailability of parsedAvailability) {
          const { day_of_week, time_slots } = dayAvailability;

          if (!validDays.includes(day_of_week) || !Array.isArray(time_slots) || time_slots.length === 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'Each availability entry must have a valid day and time_slots array' });
          }

          const [availabilityResult] = await connection.execute(
            `INSERT INTO experience_availability (experience_id, day_of_week) VALUES (?, ?)`,
            [experience_id, day_of_week]
          );
          const availability_id = availabilityResult.insertId;

          for (const slot of time_slots) {
            const { start_time, end_time } = slot;

            if (!start_time || !end_time) {
              await connection.rollback();
              return res.status(400).json({ message: 'Each time slot must have a start_time and end_time' });
            }

            await connection.execute(
              `INSERT INTO availability_time_slots (availability_id, start_time, end_time) VALUES (?, ?, ?)`,
              [availability_id, start_time, end_time]
            );
          }
        }
      }
    }

    // Handle tags update
    if (tags !== undefined) {
      let parsedTags;
      try {
        parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
      } catch (e) {
        await connection.rollback();
        return res.status(400).json({ message: 'Invalid tags format' });
      }

      if (Array.isArray(parsedTags) && parsedTags.length > 0) {
        // Verify all tag IDs exist
        const [existingTags] = await connection.query(
          'SELECT tag_id FROM tags WHERE tag_id IN (?)',
          [parsedTags]
        );
        
        if (existingTags.length !== parsedTags.length) {
          await connection.rollback();
          return res.status(400).json({ message: 'One or more tag IDs do not exist' });
        }

        // Delete existing tags
        await connection.query(
          'DELETE FROM experience_tags WHERE experience_id = ?',
          [experience_id]
        );

        // Insert new tags
        const tagValues = parsedTags.map(tag_id => [experience_id, tag_id]);
        await connection.query(
          `INSERT INTO experience_tags (experience_id, tag_id) VALUES ?`,
          [tagValues]
        );
      }
    }

    // Handle image deletions
    if (images_to_delete && Array.isArray(images_to_delete) && images_to_delete.length > 0) {
      // Delete from database
      await connection.query(
        'DELETE FROM experience_images WHERE experience_id = ? AND image_id IN (?)',
        [experience_id, images_to_delete]
      );

      // You might want to also delete physical files here
      // This would require getting the file paths first and using fs.unlink
    }

    // Handle new image uploads
    if (files && files.length > 0) {
      const imageValues = files.map(file => {
        const filename = file.path.split('\\').pop().split('/').pop();
        const webPath = `uploads/experiences/${filename}`;
        return [experience_id, webPath];
      });

      await connection.query(
        'INSERT INTO experience_images (experience_id, image_url) VALUES ?',
        [imageValues]
      );
    }

    // Commit transaction
    await connection.commit();
    connection.release();

    // Fetch updated data to return
    const [updatedExperience] = await db.query(
      'SELECT * FROM experience WHERE experience_id = ?',
      [experience_id]
    );

    // Parse travel_companions for response
    const experience = updatedExperience[0];
    if (experience.travel_companions) {
      // MySQL returns JSON as parsed array already
      if (!Array.isArray(experience.travel_companions)) {
        try {
          experience.travel_companions = JSON.parse(experience.travel_companions);
        } catch (e) {
          experience.travel_companions = [];
        }
      }
    } else if (experience.travel_companion) {
      experience.travel_companions = [experience.travel_companion];
    } else {
      experience.travel_companions = [];
    }

    // Fetch destination info
    const [destinationInfo] = await db.query(
      'SELECT * FROM destination WHERE destination_id = ?',
      [experience.destination_id]
    );
    
    // Fetch availability
    const [availabilityRecords] = await db.query(
      'SELECT * FROM experience_availability WHERE experience_id = ?',
      [experience_id]
    );
    
    const processedAvailability = [];
    for (const avail of availabilityRecords) {
      const [timeSlots] = await db.query(
        'SELECT * FROM availability_time_slots WHERE availability_id = ?',
        [avail.availability_id]
      );
      
      processedAvailability.push({
        ...avail,
        time_slots: timeSlots
      });
    }

    // Fetch tags
    const [tagRecords] = await db.query(
      'SELECT t.tag_id, t.name FROM tags t JOIN experience_tags et ON t.tag_id = et.tag_id WHERE et.experience_id = ?',
      [experience_id]
    );

    // Fetch images
    const [imageRecords] = await db.query(
      'SELECT * FROM experience_images WHERE experience_id = ?',
      [experience_id]
    );

    res.status(200).json({ 
      message: 'Experience updated successfully',
      experience: experience,
      destination: destinationInfo[0],
      availability: processedAvailability,
      tags: tagRecords,
      images: imageRecords || []
    });

  } catch (err) {
    await connection.rollback();
    connection.release();
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};

const updateExperienceSection = async (req, res) => {
  const { experience_id } = req.params;
  const { section } = req.body; // 'basic', 'availability', 'tags', 'destination', 'images'

  // This function can handle section-specific updates
  // You can call the main updateExperience function with only the relevant fields
  
  const allowedSections = ['basic', 'availability', 'tags', 'destination', 'images'];
  if (!allowedSections.includes(section)) {
    return res.status(400).json({ message: 'Invalid section specified' });
  }

  // Filter the request body to only include fields relevant to the section
  let filteredBody = { ...req.body };
  
  switch (section) {
    case 'basic':
      filteredBody = {
        title: req.body.title,
        description: req.body.description,
        price: req.body.price,
        unit: req.body.unit,
        status: req.body.status,
        travel_companion: req.body.travel_companion, // Keep for backward compatibility
        travel_companions: req.body.travel_companions // New array field
      };
      break;
    case 'availability':
      filteredBody = { availability: req.body.availability };
      break;
    case 'tags':
      filteredBody = { 
        tags: req.body.tags,
        travel_companion: req.body.travel_companion, // Keep for backward compatibility
        travel_companions: req.body.travel_companions // New array field
      };
      break;
    case 'destination':
      filteredBody = {
        destination_id: req.body.destination_id,
        destination_name: req.body.destination_name,
        city: req.body.city,
        destination_description: req.body.destination_description,
        latitude: req.body.latitude,
        longitude: req.body.longitude
      };
      break;
    case 'images':
      // Special handling for images section
      // Parse images_to_delete if it's a string
      let imagesToDelete = req.body.images_to_delete;
      console.log('Raw images_to_delete:', req.body.images_to_delete);
      
      if (typeof imagesToDelete === 'string') {
        try {
          imagesToDelete = JSON.parse(imagesToDelete);
          console.log('Parsed images_to_delete:', imagesToDelete);
        } catch (e) {
          console.error('Failed to parse images_to_delete:', e);
          imagesToDelete = [];
        }
      }

      // For images section, we need to handle deletions separately
      // before passing to the main update function
      if (imagesToDelete && Array.isArray(imagesToDelete) && imagesToDelete.length > 0) {
        const connection = await db.getConnection();
        try {
          await connection.beginTransaction();

          // Clean up image URLs to match database format
          const cleanedImageUrls = imagesToDelete.map(url => {
            // Remove API_URL prefix if present
            if (url.startsWith('http://') || url.startsWith('https://')) {
              const urlParts = url.split('/uploads/');
              return urlParts.length > 1 ? 'uploads/' + urlParts[1] : url;
            }
            // Remove leading slash if present to match database format
            if (url.startsWith('/uploads/')) {
              return url.substring(1); // Remove the leading slash
            }
            return url;
          });
          
          console.log('Cleaned image URLs:', cleanedImageUrls);
          console.log('Original URLs from frontend:', imagesToDelete);

          // Get the actual image records from database to verify they belong to this experience
          const [existingImages] = await connection.query(
            'SELECT image_id, image_url FROM experience_images WHERE experience_id = ? AND image_url IN (?)',
            [experience_id, cleanedImageUrls]
          );
          
          console.log('Found images to delete:', existingImages);

          if (existingImages.length > 0) {
            // Delete from database
            const imageIds = existingImages.map(img => img.image_id);
            await connection.query(
              'DELETE FROM experience_images WHERE image_id IN (?)',
              [imageIds]
            );
            console.log('Deleted image records:', imageIds);

            // Delete physical files
            for (const image of existingImages) {
              try {
                // Construct the full file path
                const filePath = path.join(__dirname, '..', '..', 'public', image.image_url);
                await unlinkAsync(filePath);
                console.log(`Deleted file: ${filePath}`);
              } catch (fileErr) {
                console.error(`Error deleting file ${image.image_url}:`, fileErr);
                // Continue even if file deletion fails
              }
            }
          } else {
            console.log('No matching images found to delete');
          }

          await connection.commit();
          console.log('Image deletion transaction committed');
        } catch (err) {
          await connection.rollback();
          console.error('Error deleting images:', err);
          return res.status(500).json({ 
            message: 'Failed to delete images', 
            error: err.message 
          });
        } finally {
          connection.release();
        }
      }

      // Set filteredBody for any new images that need to be uploaded
      filteredBody = { 
        // Don't include images_to_delete in the main update
        // as we've already handled deletions above
      };
      
      // The req.files will be handled by the main updateExperience function
      break;
  }

  // Clean undefined values
  Object.keys(filteredBody).forEach(key => {
    if (filteredBody[key] === undefined) {
      delete filteredBody[key];
    }
  });

  req.body = filteredBody;
  return updateExperience(req, res);
};

const updateExperienceStatus = async (req, res) => {
  const { experience_id } = req.params; // experience_id from URL
  const { status } = req.body; // new status from request body
  
  // Get database connection
  const connection = await db.getConnection();
  
  try {
    // Validate status value
    const validStatuses = ['draft', 'inactive', 'active'];
    if (!status || !validStatuses.includes(status)) {
      connection.release();
      return res.status(400).json({ 
        message: 'Invalid status value. Must be one of: draft, inactive, active' 
      });
    }
    
    // Check if experience exists
    const [experience] = await connection.query(
      'SELECT experience_id, creator_id, status FROM experience WHERE experience_id = ?',
      [experience_id]
    );
    
    if (experience.length === 0) {
      connection.release();
      return res.status(404).json({ message: 'Experience not found' });
    }
    
    // Optional: Check if the user is the creator of the experience
    // This assumes you have user info from auth middleware in req.user
    if (req.user && req.user.user_id !== experience[0].creator_id) {
      connection.release();
      return res.status(403).json({ 
        message: 'You are not authorized to update this experience' 
      });
    }
    
    // Check if status is actually changing
    if (experience[0].status === status) {
      connection.release();
      return res.status(200).json({ 
        message: 'Status is already set to ' + status,
        experience_id: parseInt(experience_id),
        status: status
      });
    }
    
    // Update the experience status
    const [result] = await connection.query(
      'UPDATE experience SET status = ?, updated_at = NOW() WHERE experience_id = ?',
      [status, experience_id]
    );
    
    if (result.affectedRows === 0) {
      connection.release();
      return res.status(500).json({ message: 'Failed to update experience status' });
    }
    
    // Log the status change (optional - for audit trail)
    console.log(`✅ Experience ${experience_id} status updated from ${experience[0].status} to ${status}`); // FIXED: changed 'id' to 'experience_id'
    
    // Optional: If you have a status history table, insert a record
    // await connection.query(
    //   'INSERT INTO experience_status_history (experience_id, old_status, new_status, changed_by, changed_at) VALUES (?, ?, ?, ?, NOW())',
    //   [experience_id, experience[0].status, status, req.user?.user_id || null] // FIXED: changed 'id' to 'experience_id'
    // );
    
    connection.release();
    
    // Return success response
    return res.status(200).json({ // Added 'return' for clarity
      message: 'Experience status updated successfully',
      experience_id: parseInt(experience_id),
      old_status: experience[0].status,
      new_status: status,
      updated_at: new Date()
    });
    
  } catch (err) {
    connection.release();
    console.error('Error updating experience status:', err);
    return res.status(500).json({ // Added 'return' for clarity
      error: 'Server error', 
      details: err.message 
    });
  }
};




module.exports = { upload, createExperienceHandler: [upload.array('images', 5), createExperience], createExperience, createMultipleExperiences, getAllExperience, getExperienceTitlesAndTags,getExperienceAvailability, getExperienceById, getAvailableTimeSlots, updateExperience,updateExperienceSection,updateExperienceStatus, getExperienceByUserID, getActiveExperience };
