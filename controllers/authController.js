//authController.js
require('dotenv').config(); // Load environment variables

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
        last_name: user.last_name
      },
      process.env.JWT_SECRET,       // The secret key stored in your .env file for signing the token
      { expiresIn: '1h' }           // Token's expiration time; 1 hour in this case
    );

    // Return both the token and the user data
    res.status(200).json({ token, user });  // Send both token and user data

  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
