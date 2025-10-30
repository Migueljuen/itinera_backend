require('dotenv').config();

const db = require('../config/db.js');


// Create new tags
const createTag = async (req, res) => {
  const { tags } = req.body;

  if (!tags || !Array.isArray(tags) || tags.length === 0) {
    return res.status(400).json({ message: 'At least one tag is required' });
  }

  try {
    await db.query('START TRANSACTION');

    const createdTags = [];

    for (const tag of tags) {
      const { name, category_id } = tag;

      if (!name || !category_id) {
        await db.query('ROLLBACK');
        return res.status(400).json({
          message: 'Each tag must have a name and category_id'
        });
      }

      // Check if the tag already exists in this category
      const [existing] = await db.query(
        'SELECT tag_id, name, category_id, is_default FROM tags WHERE name = ? AND category_id = ? LIMIT 1',
        [name, category_id]
      );

      if (existing.length > 0) {
        const existingTag = existing[0];

        if (existingTag.is_default === 0) {
          // ✅ Tag already exists and is user-created, reuse it
          createdTags.push(existingTag);
          continue;
        } else {
          // ❌ Tag is a default tag — duplicate creation not allowed
          await db.query('ROLLBACK');
          return res.status(400).json({
            message: `Tag "${name}" already exists in this category`
          });
        }
      }

      // Insert a new tag (user-created tag => is_default = 0)
      const [result] = await db.query(
        'INSERT INTO tags (name, category_id, is_default) VALUES (?, ?, 0)',
        [name, category_id]
      );

      createdTags.push({
        tag_id: result.insertId,
        name,
        category_id,
        is_default: 0
      });
    }

    await db.query('COMMIT');

    res.status(201).json({
      message: 'Tags created or selected successfully',
      tags: createdTags
    });

  } catch (err) {
    console.error('Error creating tags:', err);
    await db.query('ROLLBACK');
    res.status(500).json({ error: 'Server error while creating tags' });
  }
};





// Get all tags
const getAllTags = async (req, res) => {
  try {
    const [tags] = await db.query('SELECT * FROM tags where is_default = 1');
    res.status(200).json({ tags });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get categories with their related tags
const getCategoriesWithTags = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        c.category_id, 
        c.name AS category_name, 
        t.tag_id, 
        t.name AS tag_name
      FROM categories c
      LEFT JOIN tags t ON c.category_id = t.category_id
      ORDER BY c.category_id, t.tag_id
    `);

    // Group tags under their categories
    const categories = {};
    rows.forEach(row => {
      if (!categories[row.category_id]) {
        categories[row.category_id] = {
          category_id: row.category_id,
          category_name: row.category_name,
          tags: []
        };
      }

      if (row.tag_id) {
        categories[row.category_id].tags.push({
          tag_id: row.tag_id,
          tag_name: row.tag_name
        });
      }
    });

    res.status(200).json({ categories: Object.values(categories) });
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
  getCategoriesWithTags,
  updateTag,
  deleteTag
};
