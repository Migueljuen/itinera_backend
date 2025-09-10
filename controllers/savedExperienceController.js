const db = require('../config/db.js');

// Toggle save/unsave experience
const toggleSavedExperience = async (req, res) => {
  const { experience_id, user_id } = req.body;

  // console.log('Request body:', req.body);
  // console.log('User ID:', user_id, 'Type:', typeof user_id);

  if (!experience_id) {
    return res.status(400).json({ error: 'Experience ID is required' });
  }

  if (!user_id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  // Ensure user_id is a number
  const actualUserId = parseInt(user_id);
  
  if (isNaN(actualUserId)) {
    return res.status(400).json({ error: 'Valid User ID is required' });
  }

  const connection = await db.getConnection();

  try {
    // Check if already saved
    const [existing] = await connection.query(
      'SELECT id FROM saved_experiences WHERE user_id = ? AND experience_id = ?',
      [actualUserId, experience_id]
    );

    if (existing.length > 0) {
      // Remove from saved
      await connection.query(
        'DELETE FROM saved_experiences WHERE user_id = ? AND experience_id = ?',
        [actualUserId, experience_id]
      );
      
      connection.release();
      res.json({ 
        success: true, 
        action: 'removed',
        message: 'Experience removed from saved list' 
      });
    } else {
      // Add to saved
      await connection.query(
        'INSERT INTO saved_experiences (user_id, experience_id) VALUES (?, ?)',
        [actualUserId, experience_id]
      );
      
      connection.release();
      res.json({ 
        success: true, 
        action: 'saved',
        message: 'Experience saved successfully' 
      });
    }
  } catch (error) {
    connection.release();
    console.error('Error toggling saved experience:', error);
    
    // Handle duplicate entry error
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Experience already saved' });
    }
    
    res.status(500).json({ error: 'Failed to update saved status' });
  }
};

// Check if experience is saved
const checkSavedStatus = async (req, res) => {
  const { experienceId } = req.params;
  const { user_id } = req.query; // Get user_id from query parameters

  if (!experienceId) {
    return res.status(400).json({ error: 'Experience ID is required' });
  }

  if (!user_id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  const connection = await db.getConnection();

  try {
    const [result] = await connection.query(
      'SELECT id FROM saved_experiences WHERE user_id = ? AND experience_id = ?',
      [user_id, experienceId]
    );
    
    connection.release();
    res.json({ 
      isSaved: result.length > 0 
    });
  } catch (error) {
    connection.release();
    console.error('Error checking saved status:', error);
    res.status(500).json({ error: 'Failed to check saved status' });
  }
};

// Get all saved experiences for a user
const getSavedExperiences = async (req, res) => {
  const { user_id } = req.query; // Get user_id from query parameters

  if (!user_id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  const connection = await db.getConnection();

  try {
    const [savedExperiences] = await connection.query(
      `SELECT 
        se.id,
        se.saved_at,
        e.experience_id,
        e.title,
        e.description,
        e.price,
        e.unit,
        d.name as destination_name,
        d.city,
        GROUP_CONCAT(DISTINCT ei.image_url) as images,
        GROUP_CONCAT(DISTINCT t.name) as tags
      FROM saved_experiences se
      JOIN experience e ON se.experience_id = e.experience_id
      LEFT JOIN destination d ON e.destination_id = d.destination_id
      LEFT JOIN experience_images ei ON e.experience_id = ei.experience_id
      LEFT JOIN experience_tags et ON e.experience_id = et.experience_id
      LEFT JOIN tags t ON et.tag_id = t.tag_id
      WHERE se.user_id = ? AND e.status = 'active'
      GROUP BY se.id, e.experience_id
      ORDER BY se.saved_at DESC`,
      [user_id]
    );
    
    // Format the response
    const formattedExperiences = savedExperiences.map(exp => ({
      ...exp,
      images: exp.images ? exp.images.split(',') : [],
      tags: exp.tags ? exp.tags.split(',') : []
    }));
    
    connection.release();
    res.json(formattedExperiences);
  } catch (error) {
    connection.release();
    console.error('Error fetching saved experiences:', error);
    res.status(500).json({ error: 'Failed to fetch saved experiences' });
  }
};

// Get saved experience IDs only (for bulk checking)
const getSavedExperienceIds = async (req, res) => {
  const { user_id } = req.query; // Get user_id from query parameters

  if (!user_id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  const connection = await db.getConnection();

  try {
    const [result] = await connection.query(
      'SELECT experience_id FROM saved_experiences WHERE user_id = ?',
      [user_id]
    );
    
    const savedIds = result.map(row => row.experience_id);
    
    connection.release();
    res.json(savedIds);
  } catch (error) {
    connection.release();
    console.error('Error fetching saved experience IDs:', error);
    res.status(500).json({ error: 'Failed to fetch saved experience IDs' });
  }
};

// Remove saved experience
const removeSavedExperience = async (req, res) => {
  const { experienceId } = req.params;
  const { user_id } = req.body; // Get user_id from request body

  if (!experienceId) {
    return res.status(400).json({ error: 'Experience ID is required' });
  }

  if (!user_id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  const connection = await db.getConnection();

  try {
    const [result] = await connection.query(
      'DELETE FROM saved_experiences WHERE user_id = ? AND experience_id = ?',
      [user_id, experienceId]
    );
    
    connection.release();
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Saved experience not found' });
    }
    
    res.json({ 
      success: true, 
      message: 'Experience removed from saved list' 
    });
  } catch (error) {
    connection.release();
    console.error('Error removing saved experience:', error);
    res.status(500).json({ error: 'Failed to remove saved experience' });
  }
};

// Bulk save experiences (for syncing)
const bulkSaveExperiences = async (req, res) => {
  const { experience_ids, user_id } = req.body; // Get user_id from request body

  if (!experience_ids || !Array.isArray(experience_ids) || experience_ids.length === 0) {
    return res.status(400).json({ error: 'Experience IDs array is required' });
  }

  if (!user_id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    // Prepare values for batch insert
    const values = experience_ids.map(exp_id => [user_id, exp_id]);
    
    // Use INSERT IGNORE to skip duplicates
    await connection.query(
      'INSERT IGNORE INTO saved_experiences (user_id, experience_id) VALUES ?',
      [values]
    );
    
    await connection.commit();
    connection.release();
    
    res.json({ 
      success: true, 
      message: `${experience_ids.length} experiences processed` 
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('Error bulk saving experiences:', error);
    res.status(500).json({ error: 'Failed to bulk save experiences' });
  }
};

module.exports = {
  toggleSavedExperience,
  checkSavedStatus,
  getSavedExperiences,
  getSavedExperienceIds,
  removeSavedExperience,
  bulkSaveExperiences
};