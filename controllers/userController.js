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
  const { user_id } = req.params;
  const { 
    first_name, 
    last_name, 
    email, 
    mobile_number,
    current_password,  // Only needed if changing password
    new_password       // Only needed if changing password
  } = req.body;

  try {
    // Verify user exists
    const [existing] = await db.query('SELECT * FROM users WHERE user_id = ?', [user_id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if email is being changed and if it's already taken
    if (email && email !== existing[0].email) {
      const [emailCheck] = await db.query(
        'SELECT * FROM users WHERE email = ? AND user_id != ?', 
        [email, user_id]
      );
      if (emailCheck.length > 0) {
        return res.status(409).json({ message: 'Email already in use' });
      }
    }

    // Build dynamic update query
    const updates = [];
    const values = [];

    if (first_name) {
      updates.push('first_name = ?');
      values.push(first_name);
    }
    if (last_name) {
      updates.push('last_name = ?');
      values.push(last_name);
    }
    if (email) {
      updates.push('email = ?');
      values.push(email);
    }
    if (mobile_number !== undefined) {
      updates.push('mobile_number = ?');
      values.push(mobile_number);
    }

    // Handle profile picture upload
    if (req.file) {
      updates.push('profile_pic = ?');
      values.push(req.file.path);
    }

    // Handle password update (if both current and new are provided)
    if (current_password && new_password) {
      // Verify current password
      const isMatch = await bcrypt.compare(current_password, existing[0].password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Current password is incorrect' });
      }

      if (new_password.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters' });
      }

      // Hash and add to update
      const hashedPassword = await bcrypt.hash(new_password, 10);
      updates.push('password = ?');
      values.push(hashedPassword);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    values.push(user_id);

    // Update user
    await db.query(
      `UPDATE users SET ${updates.join(', ')} WHERE user_id = ?`,
      values
    );

    // Fetch updated user data (excluding password)
    const [updatedUser] = await db.query(
      'SELECT user_id, first_name, last_name, email, mobile_number, profile_pic, role, created_at FROM users WHERE user_id = ?',
      [user_id]
    );

    res.status(200).json({ 
      success: true,
      message: 'User updated successfully',
      user: updatedUser[0],
      profile_pic_path: updatedUser[0].profile_pic
    });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Server error' });
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
const getAdminDashboardStats = async (req, res) => {
   try {
     // 1. Count active experiences
      const [activeExperiences] = await db.query(` SELECT COUNT(*) as count FROM experience WHERE status = 'active' `);
     // 2. Count pending experiences
        const [pendingExperiences] = await db.query(` SELECT COUNT(*) as count FROM experience WHERE status = 'pending' `);
     // 3. Count active creators 
      const [activeCreators] = await db.query(`
      SELECT COUNT(DISTINCT u.user_id) as count 
      FROM users u
      JOIN experience e ON u.user_id = e.creator_id 
      WHERE u.role = 'creator' AND e.status = 'active' 
    `); 
    // 4. Count pending creators 
      const [pendingCreators] = await db.query(`
         SELECT COUNT(DISTINCT u.user_id) as count 
         FROM users u WHERE u.role = 'creator' 
         AND u.user_id IN ( SELECT DISTINCT creator_id FROM experience WHERE status IN ('pending', 'draft') ) 
         AND u.user_id NOT IN ( SELECT DISTINCT creator_id FROM experience WHERE status = 'active' ) `);
          // 5. 
         res.status(200).json({ 
          success: true, 
          stats: { 
            activeExperiences: {
               count: activeExperiences[0].count, 
               percentageChange: null
              },
                pendingExperiences: {
               count: pendingExperiences[0].count 
              }, activeCreators: { 
                count: activeCreators[0].count, 
                percentageChange: null },
               pendingCreators: { 
                count: pendingCreators[0].count } } }); } catch (error) { console.error('Error fetching admin dashboard stats:', error); res.status(500).json({ success: false, message: 'Failed to fetch dashboard statistics' }); }
 };



module.exports = { upload, registerUser, getAllUsers, getUserById,getUserStats,getAdminDashboardStats, updateUser  };
