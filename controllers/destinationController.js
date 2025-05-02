require('dotenv').config();

const db = require('../config/db.js');
const bcrypt = require('bcrypt');  



const createDestination = async (req, res) => {
  const { name, city, description, latitude, longitude } = req.body;

  // Validate required fields
  if (!name || !city || !description || !latitude || !longitude) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    // Check if the destination already exists (optional: based on name and city)
    const [existing] = await db.query(
      'SELECT * FROM destination WHERE name = ? AND city = ?', 
      [name, city]
    );

    if (existing.length > 0) {
      return res.status(409).json({ message: 'Destination already exists' });
    }

    // Insert new destination
    await db.query(
      'INSERT INTO destination (name, city, description, latitude, longitude) VALUES (?, ?, ?, ?, ?)',
      [name, city, description, latitude, longitude]
    );

    // Return success
    res.status(201).json({ message: 'Destination created successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};




const getAllDestination = async (req, res) => {
  try {
    const [destinations] = await db.query('SELECT * FROM destination');
    res.status(200).json(destinations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch destinations ' });
  }
};

const getDestinationById = async (req, res) => {
  const { id } = req.params; 

  try {
    const [destination] = await db.query('SELECT * FROM destination WHERE destination_id = ?', [id]);

    if (destination.length === 0) {
      return res.status(404).json({ error: 'Destination not found' });
    }

    res.status(200).json(destination[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch destination' });
  }
};

const updateDestination = async (req, res) => {
  const { id } = req.params;
  const { name, city, description, latitude, longitude } = req.body;

  try {
    // Check if destination exists
    const [existing] = await db.query('SELECT * FROM destination WHERE destination_id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Destination not found' });
    }

    // Update destination
    await db.query(
      `UPDATE destination 
       SET name = ?, city = ?, description = ?, latitude = ?, longitude = ? 
       WHERE destination_id = ?`,
      [
        name || existing[0].name,
        city || existing[0].city,
        description || existing[0].description,
        latitude || existing[0].latitude,
        longitude || existing[0].longitude,
        id
      ]
    );

    res.status(200).json({ message: 'Destination updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update Destination' });
  }
};


module.exports = { createDestination, getAllDestination, getDestinationById, updateDestination  };
