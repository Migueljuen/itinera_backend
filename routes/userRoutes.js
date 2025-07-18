const express = require('express');
const router = express.Router();
const { upload, registerUser, getAllUsers, getUserById,getUserStats, updateUser } = require('../controllers/userController.js');
const authenticateToken = require('../middleware/auth');



// router.get('/profile', authenticateToken, (req, res) => {
//     res.json({
//       message: 'You have access to a protected route!',
//       user: req.user // This comes from the token payload
//     });
//   });

// Register route
router.post('/register', registerUser);


// Get all users
router.get('/', getAllUsers); 

// Get user by ID
router.get('/:id', getUserById); 
// Add this route to your user routes file (e.g., userRoutes.js)

router.get('/:id/stats', getUserStats);

// Update
router.put('/:id', upload.single('profile_pic'), updateUser);

module.exports = router;
