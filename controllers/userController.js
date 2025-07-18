require('dotenv').config();

const db = require('../config/db.js');
const bcrypt = require('bcrypt');  
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/profile-pics';
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Create unique filename with original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'profile-' + uniqueSuffix + ext);
  }
});

// File filter to accept only images
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Configure the upload
const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});


const registerUser = async (req, res) => {
  const { first_name, last_name, email, password, role } = req.body;

  // Validate 
  if (!first_name || !last_name || !email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    // Check if the email is already registered
    const [existing] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    // Set default role if not provided
    const userRole = role || 'Creator';
    // const userRole = role || 'Traveler';
    // Hash 
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user with role
    await db.query(
      'INSERT INTO users (first_name, last_name, email, password, role) VALUES (?, ?, ?, ?, ?)', 
      [first_name, last_name, email, hashedPassword, userRole]
    );

    // Return success 
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};



const getAllUsers = async (req, res) => {
  try {
    const [users] = await db.query('SELECT * FROM users');
    res.status(200).json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users ' });
  }
};

const getUserById = async (req, res) => {
  const { id } = req.params; 

  try {
    const [user] = await db.query('SELECT * FROM users WHERE user_id = ?', [id]);

    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json(user[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, email, password, role } = req.body;
    
    // Check if user exists
    const [existing] = await db.query('SELECT * FROM users WHERE user_id = ?', [id]);
    if (existing.length === 0) {
      // If there's an uploaded file, remove it since user doesn't exist
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({ message: 'User not found' });
    }

    // Hash new password if provided
    let hashedPassword = existing[0].password; // keep existing if no new one
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }
    
    // Handle profile picture
    let profilePicPath = existing[0].profile_pic; // Keep existing if no new one
    
    if (req.file) {
      // If we have a new profile pic
      profilePicPath = req.file.path.replace(/\\/g, '/'); // Normalize path for all OS
      
      // Remove old profile pic if it exists and is not the default
      if (existing[0].profile_pic && !existing[0].profile_pic.includes('default-profile.jpg')) {
        try {
          fs.unlinkSync(existing[0].profile_pic);
        } catch (err) {
          console.error('Failed to delete old profile pic:', err);
          // Continue with update even if delete fails
        }
      }
    }

    // Update user
    await db.query(
      `UPDATE users 
       SET first_name = ?, last_name = ?, email = ?, password = ?, role = ?, profile_pic = ? 
       WHERE user_id = ?`,
      [
        first_name || existing[0].first_name,
        last_name || existing[0].last_name,
        email || existing[0].email,
        hashedPassword,
        role || existing[0].role,
        profilePicPath,
        id
      ]
    );

    res.status(200).json({ 
      message: 'User updated successfully',
      user: {
        user_id: id,
        first_name: first_name || existing[0].first_name,
        last_name: last_name || existing[0].last_name,
        email: email || existing[0].email,
        role: role || existing[0].role,
        profile_pic: profilePicPath
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update user', details: err.message });
  }
};

const getUserStats = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get completed itineraries count
    const [completedItineraries] = await db.query(
      `SELECT COUNT(*) as count 
       FROM itinerary 
       WHERE traveler_id = ? AND status = 'completed'`,
      [id]
    );
    
    // Get total itineraries count
    const [totalItineraries] = await db.query(
      `SELECT COUNT(*) as count 
       FROM itinerary 
       WHERE traveler_id = ?`,
      [id]
    );
    
    // Get activities completed (items in completed itineraries)
    const [completedActivities] = await db.query(
      `SELECT COUNT(DISTINCT ii.item_id) as count 
       FROM itinerary_items ii
       JOIN itinerary i ON ii.itinerary_id = i.itinerary_id
       WHERE i.traveler_id = ? AND i.status = 'completed'`,
      [id]
    );
    
    // Get upcoming trips count
    const [upcomingTrips] = await db.query(
      `SELECT COUNT(*) as count 
       FROM itinerary 
       WHERE traveler_id = ? AND status = 'upcoming'`,
      [id]
    );
    
    // Get saved experiences count
    const [savedExperiences] = await db.query(
      `SELECT COUNT(*) as count 
       FROM saved_experiences 
       WHERE user_id = ?`,
      [id]
    );
    
    res.json({
      success: true,
      stats: {
        totalItineraries: totalItineraries[0].count,
        completedItineraries: completedItineraries[0].count,
        completedActivities: completedActivities[0].count,
        upcomingTrips: upcomingTrips[0].count,
        savedExperiences: savedExperiences[0].count
      }
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch user statistics' 
    });
  }
};




module.exports = { upload, registerUser, getAllUsers, getUserById,getUserStats, updateUser  };
