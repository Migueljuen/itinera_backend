require('dotenv').config();

const db = require('../config/db.js');


// Create a new tag
const createTag = async (req, res) => {
  const { tags } = req.body;

  if (!tags || !Array.isArray(tags) || tags.length === 0) {
    return res.status(400).json({ message: 'At least one tag is required' });
  }

  try {
    // Using a transaction to ensure atomicity if inserting multiple tags
    await db.query('START TRANSACTION');

    // Insert each tag into the database
    for (const tag of tags) {
      if (!tag.name) {
        // If any tag doesn't have a name, return an error
        await db.query('ROLLBACK');
        return res.status(400).json({ message: 'Tag name is required for each tag' });
      }
      await db.query('INSERT INTO tags (name) VALUES (?)', [tag.name]);
    }

    await db.query('COMMIT');
    res.status(201).json({ message: 'Tags created successfully' });
  } catch (err) {
    console.error(err);
    await db.query('ROLLBACK');
    res.status(500).json({ error: 'Server error' });
  }
};


// Get all tags
const getAllTags = async (req, res) => {
  try {
    const [tags] = await db.query('SELECT * FROM tags');
    res.status(200).json({ tags });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get a single tag by ID
const getTagById = async (req, res) => {
  const { tag_id } = req.params;

  if (!tag_id) {
    return res.status(400).json({ message: 'Tag ID is required' });
  }

  try {
    const [tag] = await db.query('SELECT * FROM tags WHERE tag_id = ?', [tag_id]);

    if (tag.length === 0) {
      return res.status(404).json({ message: 'Tag not found' });
    }

    res.status(200).json({ tag: tag[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Update a tag
const updateTag = async (req, res) => {
  const { tag_id } = req.params;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'Tag name is required' });
  }

  try {
    const [result] = await db.query('UPDATE tags SET name = ? WHERE tag_id = ?', [name, tag_id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Tag not found' });
    }

    res.status(200).json({ message: 'Tag updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Delete a tag
const deleteTag = async (req, res) => {
  const { tag_id } = req.params;

  try {
    const [result] = await db.query('DELETE FROM tags WHERE tag_id = ?', [tag_id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Tag not found' });
    }

    res.status(200).json({ message: 'Tag deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  createTag,
  getAllTags,
  getTagById,
  updateTag,
  deleteTag
};
