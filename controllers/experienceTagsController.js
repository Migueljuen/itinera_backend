// controllers/experienceTagsController.js
const db = require('../config/db.js');

// Add tags to an experience
const addTagsToExperience = async (req, res) => {
  const { experience_id, tag_ids } = req.body; // Expecting an array of tag IDs

  // Validate
  if (!experience_id || !Array.isArray(tag_ids) || tag_ids.length === 0) {
    return res.status(400).json({ message: 'Experience ID and tag IDs are required' });
  }

  try {
    // Insert tags for the experience
    const insertValues = tag_ids.map(tag_id => [experience_id, tag_id]);

    await db.query(
      'INSERT INTO experience_tags (experience_id, tag_id) VALUES ?',
      [insertValues]
    );

    res.status(201).json({ message: 'Tags successfully added to experience' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get tags for an experience
const getTagsForExperience = async (req, res) => {
  const { experience_id } = req.params;

  if (!experience_id) {
    return res.status(400).json({ message: 'Experience ID is required' });
  }

  try {
    const [tags] = await db.query(
      `SELECT t.tag_id, t.name 
       FROM experience_tags et
       JOIN tags t ON et.tag_id = t.tag_id
       WHERE et.experience_id = ?`,
      [experience_id]
    );

    res.status(200).json({ tags });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Remove a tag from an experience
const removeTagFromExperience = async (req, res) => {
  const { experience_id, tag_id } = req.body;

  // Validate input
  if (!experience_id || !tag_id) {
    return res.status(400).json({ message: 'Experience ID and tag ID are required' });
  }

  try {
    const result = await db.query(
      'DELETE FROM experience_tags WHERE experience_id = ? AND tag_id = ?',
      [experience_id, tag_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Tag not found for this experience' });
    }

    res.status(200).json({ message: 'Tag successfully removed from experience' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};


module.exports = {
  addTagsToExperience,
  getTagsForExperience,
  removeTagFromExperience
};
