//authController.js
require('dotenv').config(); // Load environment variables
const db = require('../config/db.js');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/userModel');

exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
  

    // Find user by email
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }
const wasFirstLogin = user.is_first_login ===1;

    // Compare the provided password with the stored hashed password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // Create a JWT token using the secret key stored in .env
    const token = jwt.sign(
      { 
        user_id: user.user_id,     // User's unique ID
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
         is_first_login: user.is_first_login
      },
      process.env.JWT_SECRET,       // The secret key stored in your .env file for signing the token
      { expiresIn: '1h' }           // Token's expiration time; 1 hour in this case
    );

    // if (user.is_first_login) {
    //   await db.execute('UPDATE users SET is_first_login = 0 WHERE user_id = ?', [user.user_id]);
    //   // user.is_first_login = 0; // Update the user object to reflect the change
    // }
    if (wasFirstLogin) {
      await db.query('UPDATE users SET is_first_login = 0 WHERE user_id = ?', [user.user_id]);
      user.is_first_login = 0; // Update the user object to reflect the change
    }


    // Return both the token and the user data
    res.status(200).json({ token, user, wasFirstLogin });  // Send both token and user data

  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// exports.completeFirstLogin = async (req, res) => {
//   try {
//     const userId = req.params.id;
    
//     await db.execute('UPDATE users SET is_first_login = false WHERE user_id = ?',
      
//       [userId]
//     );
//     res.status(200).json({ message: 'First login completed successfully' });
//   } catch (error) {
//     console.error('Error completing first login:', error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// };