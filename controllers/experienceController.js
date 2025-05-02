require('dotenv').config();

const db = require('../config/db.js');
const multer = require('multer');
const path = require('path');
const fs = require('fs');


const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    // Make sure this directory exists
    cb(null, path.join(__dirname, 'uploads/experiences'));
  },
  filename: function(req, file, cb) {
    // Create unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // Get file extension
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
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
    creator_id, title, description, price, unit, availability, tags,
    
    // Destination data
    destination_name, city, destination_description, latitude, longitude,
    
    // Option to use existing destination
    destination_id
  } = req.body;

  // Begin transaction for atomicity
  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    // Validate experience required fields
    if (!creator_id || !title || !description || !price || !unit) {
      await connection.rollback();
      return res.status(400).json({ message: 'All experience fields are required' });
    }

    // Validate 'unit' value
    const validUnits = ['Entry', 'Hour', 'Day', 'Package'];
    if (!validUnits.includes(unit)) {
      await connection.rollback();
      return res.status(400).json({ message: 'Invalid unit type' });
    }

    // Validate availability data
    if (!availability || !Array.isArray(availability) || availability.length === 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'Availability information is required' });
    }

    // Validate each availability entry
    const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    for (const slot of availability) {
      if (!validDays.includes(slot.day_of_week) || !slot.start_time || !slot.end_time) {
        await connection.rollback();
        return res.status(400).json({ message: 'Each availability entry must have a valid day, start time, and end time' });
      }
    }

    // Validate tags
    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'At least one tag is required' });
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

    // Verify that all tag IDs exist
    const [existingTags] = await connection.query(
      'SELECT tag_id FROM tags WHERE tag_id IN (?)',
      [tags]
    );

    if (existingTags.length !== tags.length) {
      await connection.rollback();
      return res.status(400).json({ message: 'One or more tag IDs do not exist' });
    }

    // Handle destination - either use existing one or create new one
    let finalDestinationId;

    if (destination_id) {
      // Use existing destination if ID provided
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
      // Create new destination if no ID provided
      if (!destination_name || !city || !destination_description || !latitude || !longitude) {
        await connection.rollback();
        return res.status(400).json({ message: 'All destination fields are required when creating a new destination' });
      }
      
      // Check if destination already exists
      const [existingDestination] = await connection.query(
        'SELECT destination_id FROM destination WHERE name = ? AND city = ?', 
        [destination_name, city]
      );
      
      if (existingDestination.length > 0) {
        // Use existing destination if found
        finalDestinationId = existingDestination[0].destination_id;
      } else {
        // Create new destination
        const [newDestination] = await connection.query(
          'INSERT INTO destination (name, city, description, latitude, longitude) VALUES (?, ?, ?, ?, ?)',
          [destination_name, city, destination_description, latitude, longitude]
        );
        
        finalDestinationId = newDestination.insertId;
      }
    }

    // Insert new experience with the destination ID
    const [result] = await connection.query(
      `INSERT INTO experience 
      (creator_id, destination_id, title, description, price, unit, created_at) 
      VALUES (?, ?, ?, ?, ?, ?, CURDATE())`,
      [creator_id, finalDestinationId, title, description, price, unit]
    );

    const experience_id = result.insertId;

    // Insert availability data
    const availabilityValues = availability.map(slot => [
      experience_id,
      slot.day_of_week,
      slot.start_time,
      slot.end_time
    ]);

    await connection.query(
      `INSERT INTO experience_availability 
      (experience_id, day_of_week, start_time, end_time) 
      VALUES ?`,
      [availabilityValues]
    );

    // Insert tag associations
    const tagValues = tags.map(tag_id => [experience_id, tag_id]);

    await connection.query(
      `INSERT INTO experience_tags 
      (experience_id, tag_id) 
      VALUES ?`,
      [tagValues]
    );

    // Commit the transaction
    await connection.commit();
    
    // Fetch additional data for response
    connection.release();
    
    // Fetch the destination info
    const [destinationInfo] = await db.query(
      'SELECT * FROM destination WHERE destination_id = ?',
      [finalDestinationId]
    );
    
    // Fetch the availability records
    const [availabilityRecords] = await db.query(
      'SELECT * FROM experience_availability WHERE experience_id = ?',
      [experience_id]
    );

    // Fetch the tag information
    const [tagRecords] = await db.query(
      'SELECT t.tag_id, t.name FROM tags t JOIN experience_tags et ON t.tag_id = et.tag_id WHERE et.experience_id = ?',
      [experience_id]
    );

    // Return success with all created data
    res.status(201).json({ 
      message: 'Experience and destination created successfully',
      experience_id,
      destination_id: finalDestinationId,
      destination: destinationInfo[0],
      availability: availabilityRecords,
      tags: tagRecords
    });
  } catch (err) {
    // Roll back the transaction in case of error
    await connection.rollback();
    connection.release();
    
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};



const getAllExperience = async (req, res) => {
  try {
    // 1. Fetch all experiences with destination info and tags
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
      GROUP BY e.experience_id
    `);

    // 2. Fetch all images
    const [images] = await db.query(`
      SELECT 
        experience_id,
        image_url
      FROM experience_images
    `);

    // 3. Map images by experience_id with corrected paths
    const imageMap = {};
    images.forEach(img => {
      if (!imageMap[img.experience_id]) {
        imageMap[img.experience_id] = [];
      }
      
      // Convert absolute Windows file paths to web-accessible paths
      let webPath = img.image_url;
      
      // If the path contains Windows drive indicators or backslashes
      if (webPath.includes(':\\') || webPath.includes('\\')){
        // Extract just the filename from the path
        const filename = webPath.split('\\').pop();
        webPath = `uploads/experiences/${filename}`;
      }
      
      imageMap[img.experience_id].push(webPath);
    });

    // 4. Attach tags and images to each experience
    experiences.forEach(exp => {
      exp.tags = exp.tags ? exp.tags.split(',') : [];
      exp.images = imageMap[exp.id] || [];
      
      // For debugging
      if (exp.images.length > 0) {
        console.log(`Experience ${exp.id} has images:`, exp.images);
      }
    });

    // 5. Return the final result
    res.status(200).json(experiences);

  } catch (error) {
    console.error('Error fetching experiences:', error);
    res.status(500).json({ message: 'Failed to fetch experiences' });
  }
};


const getExperienceById = async (req, res) => {
  const { id } = req.params;

  try {
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

    const [tagRows] = await db.query(
      `SELECT t.name FROM tags t
       JOIN experience_tags et ON t.tag_id = et.tag_id
       WHERE et.experience_id = ?`,
      [id]
    );

    experience.tags = tagRows.map(tag => tag.name);

    res.json(experience);
  } catch (err) {
    console.error('Error fetching experience:', err);
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

module.exports = { upload, createExperience, getAllExperience, getExperienceById, updateExperience };
