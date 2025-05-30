require('dotenv').config();

const db = require('../config/db.js');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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
    destination_id,  travel_companion
  } = req.body;

  // Get uploaded files if any
  const files = req.files;

  // Begin transaction for atomicity
  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    // Validate experience required fields
    if (!creator_id ||  !price || !unit) {
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

    // Parse and validate tags
    console.log("Tags before parsing:", tags);
    let parsedTags;
    try {
      // Parse tags if they are sent as a string
      parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
    } catch (e) {
      await connection.rollback();
      return res.status(400).json({ message: 'Invalid tags format' });
    }

    if (!parsedTags || !Array.isArray(parsedTags) || parsedTags.length === 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'At least one tag is required' });
    }
    console.log("Tags before checking:", parsedTags);

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
      const [existingDestination] = await connection.query(
        'SELECT destination_id FROM destination WHERE name = ? AND city = ?', 
        [destination_name, city]
      );
      if (existingDestination.length > 0) {
        finalDestinationId = existingDestination[0].destination_id;
      } else {
        const [newDestination] = await connection.query(
          'INSERT INTO destination (name, city, description, latitude, longitude) VALUES (?, ?, ?, ?, ?)',
          [destination_name, city, destination_description, latitude, longitude]
        );
        finalDestinationId = newDestination.insertId;
      }
    }

    // Insert new experience with status
const [result] = await connection.query(
  `INSERT INTO experience 
  (creator_id, destination_id, title , description, price, unit, status, travel_companion, created_at) 
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURDATE())`,
  [creator_id, finalDestinationId, title || null, description || null, price, unit, experienceStatus, travel_companion]
);

    const experience_id = result.insertId;

    // Parse and validate availability after getting experience_id
    if (
      !availability ||
      (typeof availability === 'string' && !availability.trim()) ||
      (Array.isArray(availability) && availability.length === 0)
    ) {
      await connection.rollback();
      return res.status(400).json({ message: 'Availability information is required' });
    }

    let parsedAvailability;
    try {
      // Parse availability if it's a string
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

      if (
        !validDays.includes(day_of_week) ||
        !Array.isArray(time_slots) ||
        time_slots.length === 0
      ) {
        await connection.rollback();
        return res.status(400).json({ message: 'Each availability entry must have a valid day and time_slots array' });
      }

      // Insert into experience_availability
      const [availabilityResult] = await connection.execute(
        `INSERT INTO experience_availability (experience_id, day_of_week) VALUES (?, ?)`,
        [experience_id, day_of_week]
      );
      const availability_id = availabilityResult.insertId;

      // Insert all associated time slots - using the correct table name
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
      `INSERT INTO experience_tags 
      (experience_id, tag_id) 
      VALUES ?`,
      [tagValues]
    );

    // Handle image uploads if any
    if (files && files.length > 0) {
      // Convert file paths to web URLs
      const imageValues = files.map(file => {
        // Extract just the filename from the full path
        const filename = file.path.split('\\').pop().split('/').pop();
        
        // Create web-accessible path
        const webPath = `uploads/experiences/${filename}`;
        
        return [experience_id, webPath];
      });

      console.log('Web paths to be saved:', imageValues);
      
      // Insert image URLs into database
      await connection.query(
        'INSERT INTO experience_images (experience_id, image_url) VALUES ?',
        [imageValues]
      );
    }

    // Commit the transaction
    await connection.commit();
    connection.release();

    // Fetch the destination info
    const [destinationInfo] = await db.query(
      'SELECT * FROM destination WHERE destination_id = ?',
      [finalDestinationId]
    );
    
    // Fetch availability records
    const [availabilityRecords] = await db.query(
      'SELECT * FROM experience_availability WHERE experience_id = ?',
      [experience_id]
    );
    
    // Fetch time slots for each availability record
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

    // Fetch tag records
    const [tagRecords] = await db.query(
      'SELECT t.tag_id, t.name FROM tags t JOIN experience_tags et ON t.tag_id = et.tag_id WHERE et.experience_id = ?',
      [experience_id]
    );

    // Fetch uploaded images if any
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
      status: experienceStatus
    });
  } catch (err) {
    await connection.rollback();
    connection.release();
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
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
      travel_companion,
      start_time,
      end_time
    } = req.query;

    // Base query for experiences
    let query = `
      SELECT 
        e.experience_id AS id,
        e.title,
        e.description,
        e.price,
        e.unit,
        d.name AS destination_name,
        d.city AS location,
        e.travel_companion, 
        GROUP_CONCAT(DISTINCT t.name) AS tags
      FROM experience e
      JOIN destination d ON e.destination_id = d.destination_id
      LEFT JOIN experience_tags et ON e.experience_id = et.experience_id
      LEFT JOIN tags t ON et.tag_id = t.tag_id
      LEFT JOIN experience_availability a ON e.experience_id = a.experience_id
      LEFT JOIN availability_time_slots ts ON a.availability_id = ts.availability_id
    `;

    const params = [];
    const conditions = [];

    // Location filter
    if (location) {
      conditions.push(`LOWER(d.city) LIKE ?`);
      params.push(`%${location.trim().toLowerCase()}%`);
    }

    // Travel companion filter
    if (travel_companion) {
      conditions.push(`LOWER(e.travel_companion) = LOWER(?)`);
      params.push(travel_companion.trim());
    }

    // Explore time filter (based on hour of ts.start_time)
    if (explore_time) {
      switch (explore_time.toLowerCase()) {
        case 'daytime':
          conditions.push('HOUR(ts.start_time) < 18');
          break;
        case 'nighttime':
          conditions.push('HOUR(ts.start_time) >= 18');
          break;
        case 'both':
        default:
          // No filter
          break;
      }
    }

    // Budget filter
    if (budget) {
      let budgetCondition = '';
      switch (budget.toLowerCase()) {
        case 'free':
          budgetCondition = 'e.price = 0';
          break;
        case 'budget-friendly':
          budgetCondition = 'e.price <= 500';
          break;
        case 'mid-range':
          budgetCondition = 'e.price > 500 AND e.price <= 2000';
          break;
        case 'premium':
          budgetCondition = 'e.price > 2000';
          break;
      }
      if (budgetCondition) {
        conditions.push(budgetCondition);
      }
    }

    // Tag filtering
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

    // Date range filtering (day_of_week) - ADD THIS TO CONDITIONS ARRAY
    if (start_date && end_date) {
      const startDate = new Date(start_date);
      const endDate = new Date(end_date);
      const tripDaysOfWeek = [];

      // Debug logging
      console.log('Date filtering:', { start_date, end_date, startDate, endDate });

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        tripDaysOfWeek.push(d.getDay());
      }

      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const tripDayNames = [...new Set(tripDaysOfWeek.map(dayNum => dayNames[dayNum]))];

      console.log('Trip days:', tripDayNames);

      // Add this as a regular condition
      conditions.push(`e.experience_id IN (
        SELECT DISTINCT a2.experience_id 
        FROM experience_availability a2
        JOIN availability_time_slots ts2 ON a2.availability_id = ts2.availability_id
        WHERE a2.day_of_week IN (${tripDayNames.map(() => '?').join(',')})
        AND ts2.start_time IS NOT NULL
      )`);

      params.push(...tripDayNames);
    }

    // Apply WHERE clause - this now happens AFTER all conditions are added
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Finalize with GROUP BY
    query += ` GROUP BY e.experience_id`;

    // Debug logging
    console.log('Final Query:', query);
    console.log('Final Params:', params);

    // Execute the query
    const [experiences] = await db.query(query, params);

    // Rest of your code remains the same...
    // Fetch images
    const [images] = await db.query(`
      SELECT 
        experience_id,
        image_url
      FROM experience_images
    `);

    // Get all experience IDs
    const experienceIds = experiences.map(exp => exp.id);

    // Fetch availability for these IDs
    let availabilityResults = [];
    if (experienceIds.length > 0) {
      const [results] = await db.query(`
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
      `, [experienceIds]);
      availabilityResults = results;
    }

    // Map images
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

    // Map availability
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

    // Attach data
    experiences.forEach(exp => {
      exp.tags = exp.tags ? exp.tags.split(',') : [];
      exp.images = imageMap[exp.id] || [];
      exp.availability = availabilityMap[exp.id] || [];

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

    console.log('Found experiences:', experiences.length);

    res.status(200).json(experiences);

  } catch (error) {
    console.error('Error fetching experiences:', error);
    res.status(500).json({ message: 'Failed to fetch experiences' });
  }
};

// const getAllExperience = async (req, res) => {
//   try {
//     const { 
//       location, 
//       start_date, 
//       end_date, 
//       tags, // Add this - expect comma-separated string or array
//       budget, // Add this
//       explore_time, // Add this if needed
//       travel_companion 
//     } = req.query;

//     // Base query for experiences
// let query = `
//       SELECT 
//         e.experience_id AS id,
//         e.title,
//         e.description,
//         e.price,
//         e.unit,
//         d.name AS destination_name,
//         d.city AS location,
//         e.travel_companion, 
//         GROUP_CONCAT(DISTINCT t.name) AS tags
//       FROM experience e
//       JOIN destination d ON e.destination_id = d.destination_id
//       LEFT JOIN experience_tags et ON e.experience_id = et.experience_id
//       LEFT JOIN tags t ON et.tag_id = t.tag_id
//     `;

//     const params = [];
//     const conditions = [];
//     // Location filtering
//     if (location) {
//       conditions.push(`d.city LIKE ?`);
//       params.push(`%${location.trim().toLowerCase()}%`);
//     }


// if (travel_companion) {
//   conditions.push(`LOWER(e.travel_companion) = LOWER(?)`);
// params.push(travel_companion.trim());

// }

// // ExploreTime filtering
// if (exploreTime) {
//   let timeCondition = '';
//   switch (exploreTime.toLowerCase()) {
//     case 'morning':
//       timeCondition = 'HOUR(ts.start_time) < 12';
//       break;
//     case 'afternoon':
//       timeCondition = 'HOUR(ts.start_time) >= 12 AND HOUR(ts.start_time) < 18';
//       break;
//     case 'evening':
//       timeCondition = 'HOUR(ts.start_time) >= 18';
//       break;
//     case 'both':
//     default:
//       timeCondition = ''; // No filter
//       break;
//   }

//   if (timeCondition) {
//     conditions.push(timeCondition);
//   }
// }

//     // Budget filtering
//     if (budget) {
//       let budgetCondition = '';
//       switch (budget.toLowerCase()) {
//         case 'free':
//           budgetCondition = 'e.price = 0';
//           break;
//         case 'budget-friendly':
//           budgetCondition = 'e.price <= 500';
//           break;
//         case 'mid-range':
//           budgetCondition = 'e.price > 500 AND e.price <= 2000';
//           break;
//         case 'premium':
//           budgetCondition = 'e.price > 2000';
//           break;
//       }
//       if (budgetCondition) {
//         conditions.push(budgetCondition);
//       }
//     }

//     // Tag filtering - experiences must have at least one of the specified tags
//     if (tags) {
//       const tagArray = Array.isArray(tags) ? tags : tags.split(',');
//       const cleanedTags = tagArray.map(tag => tag.trim());
      
//       if (cleanedTags.length > 0) {
//         conditions.push(`e.experience_id IN (
//           SELECT DISTINCT et2.experience_id 
//           FROM experience_tags et2 
//           JOIN tags t2 ON et2.tag_id = t2.tag_id 
//           WHERE t2.name IN (${cleanedTags.map(() => '?').join(',')})
//         )`);
//         params.push(...cleanedTags);
//       }
//     }

//     // Apply WHERE clause
//     if (conditions.length > 0) {
//       query += ` WHERE ${conditions.join(' AND ')}`;
//     }

//     // Date range filtering - only add if both dates are provided
//     if (start_date && end_date) {
//       // Convert dates to Date objects
//       const startDate = new Date(start_date);
//       const endDate = new Date(end_date);
      
//       // Get all days of the week during the trip (0-6, where 0 = Sunday)
//       const tripDaysOfWeek = [];
//       for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
//         tripDaysOfWeek.push(d.getDay());
//       }
      
//       // Convert day numbers to day names used in your database
//       const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
//       const tripDayNames = tripDaysOfWeek.map(dayNum => dayNames[dayNum]);
      
//       // Add the date range filter - experiences must have availability on at least one day of the trip
//       const dateCondition = ` 
//         ${conditions.length > 0 ? 'AND' : 'WHERE'} e.experience_id IN (
//           SELECT DISTINCT a.experience_id 
//           FROM experience_availability a
//           JOIN availability_time_slots ts ON a.availability_id = ts.availability_id
//           WHERE a.day_of_week IN (${tripDayNames.map(() => '?').join(',')})
//           AND ts.start_time IS NOT NULL
//         )
//       `;
      
//       query += dateCondition;
//       params.push(...tripDayNames);
//     }

//     // Finalize with GROUP BY
//     query += ` GROUP BY e.experience_id `;

//     // Execute the query
//     const [experiences] = await db.query(query, params);

//     // ... rest of your code for images and availability remains the same ...

//     // Fetch images
//     const [images] = await db.query(`
//       SELECT 
//         experience_id,
//         image_url
//       FROM experience_images
//     `);

//     // Fetch availability data for each experience
//     let availabilityQuery = `
//       SELECT 
//         a.experience_id,
//         a.availability_id,
//         a.day_of_week,
//         ts.slot_id,
//         ts.start_time,
//         ts.end_time
//       FROM experience_availability a
//       JOIN availability_time_slots ts ON a.availability_id = ts.availability_id
//       WHERE a.experience_id IN (?)
//     `;

//     // Get all experience IDs
//     const experienceIds = experiences.map(exp => exp.id);
    
//     // Only fetch availability if we have experiences
//     let availabilityResults = [];
//     if (experienceIds.length > 0) {
//       [availabilityResults] = await db.query(availabilityQuery, [experienceIds]);
//     }

//     // Map images
//     const imageMap = {};
//     images.forEach(img => {
//       if (!imageMap[img.experience_id]) {
//         imageMap[img.experience_id] = [];
//       }

//       let webPath = img.image_url;

//       if (webPath.includes(':\\') || webPath.includes('\\')) {
//         const filename = webPath.split('\\').pop();
//         webPath = `uploads/experience/${filename}`;
//       }

//       imageMap[img.experience_id].push(webPath);
//     });

//     // Map availability data
//     const availabilityMap = {};
//     availabilityResults.forEach(avail => {
//       if (!availabilityMap[avail.experience_id]) {
//         availabilityMap[avail.experience_id] = [];
//       }
      
//       // Find existing day entry or create new one
//       let dayAvailability = availabilityMap[avail.experience_id].find(
//         day => day.availability_id === avail.availability_id
//       );
      
//       if (!dayAvailability) {
//         dayAvailability = {
//           availability_id: avail.availability_id,
//           experience_id: avail.experience_id,
//           day_of_week: avail.day_of_week,
//           time_slots: []
//         };
//         availabilityMap[avail.experience_id].push(dayAvailability);
//       }
      
//       // Add time slot if it exists
//       if (avail.slot_id) {
//         dayAvailability.time_slots.push({
//           slot_id: avail.slot_id,
//           availability_id: avail.availability_id,
//           start_time: avail.start_time,
//           end_time: avail.end_time
//         });
//       }
//     });

//     // Attach tags, images, and availability to each experience
//     experiences.forEach(exp => {
//       exp.tags = exp.tags ? exp.tags.split(',') : [];
//       exp.images = imageMap[exp.id] || [];
//       exp.availability = availabilityMap[exp.id] || [];
      
//       // Add budget category based on price (this is now redundant since we filter by budget)
//       if (exp.price === 0) {
//         exp.budget_category = 'Free';
//       } else if (exp.price <= 500) {
//         exp.budget_category = 'Budget-friendly';
//       } else if (exp.price <= 2000) {
//         exp.budget_category = 'Mid-range';
//       } else {
//         exp.budget_category = 'Premium';
//       }
//     });
//     // For debugging
//     console.log('Query:', query);
//     console.log('Params:', params);
//     console.log('Found experiences:', experiences.length);

//     res.status(200).json(experiences);

//    } catch (error) {
//     console.error('Error fetching experiences:', error);
//     res.status(500).json({ message: 'Failed to fetch experiences' });
//   }
// };


// const getAllExperience = async (req, res) => {
//   try {
//     // 1. Fetch all experiences with destination info and tags
//     const [experiences] = await db.query(`
//       SELECT 
//         e.experience_id AS id,
//         e.title,
//         e.description,
//         e.price,
//         e.unit,
//         d.name AS destination_name,
//         d.city AS location,
//         GROUP_CONCAT(t.name) AS tags
//       FROM experience e
//       JOIN destination d ON e.destination_id = d.destination_id
//       LEFT JOIN experience_tags et ON e.experience_id = et.experience_id
//       LEFT JOIN tags t ON et.tag_id = t.tag_id
//       GROUP BY e.experience_id
//     `);

//     // 2. Fetch all images
//     const [images] = await db.query(`
//       SELECT 
//         experience_id,
//         image_url
//       FROM experience_images
//     `);

//     // 3. Map images by experience_id with corrected paths
//     const imageMap = {};
//     images.forEach(img => {
//       if (!imageMap[img.experience_id]) {
//         imageMap[img.experience_id] = [];
//       }
      
//       // Convert absolute Windows file paths to web-accessible paths
//       let webPath = img.image_url;
      
//       // If the path contains Windows drive indicators or backslashes
//       if (webPath.includes(':\\') || webPath.includes('\\')){
//         // Extract just the filename from the path
//         const filename = webPath.split('\\').pop();
//         webPath = `uploads/experiences/${filename}`;
//       }
      
//       imageMap[img.experience_id].push(webPath);
//     });

//     // 4. Attach tags and images to each experience
//     experiences.forEach(exp => {
//       exp.tags = exp.tags ? exp.tags.split(',') : [];
//       exp.images = imageMap[exp.id] || [];
      
//       // For debugging
//       if (exp.images.length > 0) {
//         console.log(`Experience ${exp.id} has images:`, exp.images);
//       }
//     });

//     // 5. Return the final result
//     res.status(200).json(experiences);

//   } catch (error) {
//     console.error('Error fetching experiences:', error);
//     res.status(500).json({ message: 'Failed to fetch experiences' });
//   }
// };
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


const getExperienceById = async (req, res) => {
  const { id } = req.params;

  try {
    // Fetch experience and destination
    const [rows] = await db.query(
      `SELECT e.*, d.name AS destination_name
       FROM experience e
       JOIN destination d ON e.destination_id = d.destination_id
       WHERE e.experience_id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Experience not found' });
    }

    const experience = rows[0];

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

    res.json(experience);
  } catch (err) {
    console.error('Error fetching experience:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
}


// const getExperienceById = async (req, res) => {
//   const { id } = req.params;

//   try {
//     // Fetch experience and destination
//     const [rows] = await db.query(
//       `SELECT e.*, d.name AS destination_name
//        FROM experience e
//        JOIN destination d ON e.destination_id = d.destination_id
//        WHERE e.experience_id = ?`,
//       [id]
//     );

//     if (rows.length === 0) {
//       return res.status(404).json({ message: 'Experience not found' });
//     }

//     const experience = rows[0];

//     // Fetch tags associated with the experience
//     const [tagRows] = await db.query(
//       `SELECT t.name FROM tags t
//        JOIN experience_tags et ON t.tag_id = et.tag_id
//        WHERE et.experience_id = ?`,
//       [id]
//     );
//     experience.tags = tagRows.map(tag => tag.name);

//     // Fetch images associated with the experience
//     const [imageRows] = await db.query(
//       `SELECT image_url FROM experience_images WHERE experience_id = ?`,
//       [id]
//     );
    
//     experience.images = imageRows.map(img => {
//       const filename = path.basename(img.image_url);
//       return `/uploads/experiences/${filename}`;
//     });

//     // Fetch availability days for this experience
//     const [availabilityRows] = await db.query(
//       `SELECT availability_id, experience_id, day_of_week
//        FROM availability
//        WHERE experience_id = ?`,
//       [id]
//     );

//     // For each availability day, fetch the time slots
//     const availabilityWithSlots = await Promise.all(
//       availabilityRows.map(async (avail) => {
//         const [timeSlots] = await db.query(
//           `SELECT slot_id, availability_id, start_time, end_time
//            FROM availability_time_slots
//            WHERE availability_id = ?`,
//           [avail.availability_id]
//         );

//         return {
//           ...avail,
//           time_slots: timeSlots,
//         };
//       })
//     );

//     experience.availability = availabilityWithSlots;

//     res.json(experience);

//   } catch (err) {
//     console.error('Error fetching experience:', err);
//     res.status(500).json({ error: 'Server error', details: err.message });
//   }
// };

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

    // For each experience, fetch tags and images
    for (const experience of experiences) {
      const experienceId = experience.experience_id;

      // Fetch tags
      const [tagRows] = await db.query(
        `SELECT t.name FROM tags t
         JOIN experience_tags et ON t.tag_id = et.tag_id
         WHERE et.experience_id = ?`,
        [experienceId]
      );
      experience.tags = tagRows.map(tag => tag.name);

      // Fetch images
      const [imageRows] = await db.query(
        `SELECT image_url FROM experience_images WHERE experience_id = ?`,
        [experienceId]
      );
      experience.images = imageRows.map(img => {
        const filename = path.basename(img.image_url);
        return `/uploads/experiences/${filename}`;
      });
    }

    res.json(experiences);
  } catch (err) {
    console.error('Error fetching experiences by user ID:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};

const updateExperience = async (req, res) => {
  try {
    const experienceId = req.params.id;
    const files = req.files;

    // Update other experience fields first...

    // Save uploaded image URLs to DB with web-accessible paths
    if (files && files.length > 0) {
      // Convert file paths to web URLs
      const values = files.map(file => {
        // Extract just the filename from the full path
        const filename = file.path.split('\\').pop().split('/').pop();
        
        // Create web-accessible path
        const webPath = `/uploads/experiences/${filename}`;
        
        return [experienceId, webPath];
      });

      console.log('Web paths to be saved:', values);
      
      const query = 'INSERT INTO experience_images (experience_id, image_url) VALUES ?';
      await db.query(query, [values]);
    }

    console.log('Files processed:', files ? files.length : 0);

    res.status(200).json({ message: 'Experience updated successfully with images' });
  } catch (error) {
    console.error('Error updating experience:', error);
    res.status(500).json({ message: 'Failed to update experience' });
  }
};

const saveExperience = async (req, res) => {
  const { user_id, experience_id } = req.body;

  console.log('Received request to save experience:', { user_id, experience_id });

  try {
    // Check if already saved
    const [existing] = await db.query(
      'SELECT * FROM saved_experiences WHERE user_id = ? AND experience_id = ?',
      [user_id, experience_id]
    );

    console.log('Check query results:', existing);

    if (existing.length > 0) {
      return res.status(400).send('Experience already saved');
    }

    // Insert new saved experience
    const [result] = await db.query(
      'INSERT INTO saved_experiences (user_id, experience_id) VALUES (?, ?)',
      [user_id, experience_id]
    );

    console.log('Experience saved successfully. Result:', result);
    return res.status(200).send('Experience saved successfully');
  } catch (err) {
    console.error('Error saving experience:', err);
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).send('Invalid user_id or experience_id.');
    }
    return res.status(500).send('Internal server error');
  }
};

const getSavedExperiences = async (req, res) => {
  const { user_id } = req.params;

  const query = `
    SELECT experience.* 
    FROM experience 
    JOIN saved_experiences ON experience.experience_id = saved_experiences.experience_id
    WHERE saved_experiences.user_id = ?
  `;

  try {
    const [results] = await db.query(query, [user_id]);
    return res.status(200).json(results);
  } catch (err) {
    console.error('Error fetching saved experiences:', err);
    return res.status(500).send('Error fetching saved experiences');
  }
};



module.exports = { upload, createExperienceHandler: [upload.array('images', 5), createExperience], createExperience, getAllExperience, getExperienceById, updateExperience, saveExperience, getSavedExperiences, getExperienceByUserID, getActiveExperience };
