
const db = require('../config/db.js');

const dayjs = require('dayjs');

// Bulk update itinerary items
const bulkUpdateItineraryItems = async (req, res) => {
  const { id: itinerary_id } = req.params;
  const { updates } = req.body;

  // Validate required fields
  if (!itinerary_id || !updates || !Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({ message: 'Itinerary ID and updates array are required' });
  }

  // Begin transaction for atomicity
  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    // Validate that the itinerary exists and belongs to the authenticated user
    const [itineraryCheck] = await connection.query(
      'SELECT itinerary_id, traveler_id FROM itinerary WHERE itinerary_id = ?',
      [itinerary_id]
    );

    if (itineraryCheck.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ message: 'Itinerary not found' });
    }

    // Optional: Add user authorization check here if you have req.user
    // if (req.user && req.user.id !== itineraryCheck[0].traveler_id) {
    //   await connection.rollback();
    //   connection.release();
    //   return res.status(403).json({ message: 'Unauthorized' });
    // }

    // Validate each update item
    for (const update of updates) {
      const { item_id, start_time, end_time, custom_note } = update;
      
      if (!item_id || !start_time || !end_time) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ message: 'Each update must include item_id, start_time, and end_time' });
      }

      // Validate time format (HH:MM or HH:MM:SS)
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
      
      if (!timeRegex.test(start_time) || !timeRegex.test(end_time)) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ message: 'Invalid time format. Use HH:MM or HH:MM:SS' });
      }

      // Validate that start_time is before end_time
      const startTimeDate = dayjs(`2000-01-01 ${start_time}`);
      const endTimeDate = dayjs(`2000-01-01 ${end_time}`);
      
      if (startTimeDate.isAfter(endTimeDate) || startTimeDate.isSame(endTimeDate)) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ message: 'Start time must be before end time' });
      }

      // Verify that the item belongs to this itinerary
      const [itemCheck] = await connection.query(
        'SELECT item_id FROM itinerary_items WHERE item_id = ? AND itinerary_id = ?',
        [item_id, itinerary_id]
      );

      if (itemCheck.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ message: `Itinerary item with ID ${item_id} not found` });
      }
    }

    // Perform bulk updates
    const updatePromises = updates.map(update => {
      const { item_id, start_time, end_time, custom_note } = update;
      return connection.query(
        `UPDATE itinerary_items 
         SET start_time = ?, end_time = ?, custom_note = ?, updated_at = ?
         WHERE item_id = ? AND itinerary_id = ?`,
        [start_time, end_time, custom_note || '', dayjs().format('YYYY-MM-DD HH:mm:ss'), item_id, itinerary_id]
      );
    });

    await Promise.all(updatePromises);

    // Update the itinerary's updated_at timestamp
    await connection.query(
      'UPDATE itinerary SET updated_at = ? WHERE itinerary_id = ?',
      [dayjs().format('YYYY-MM-DD HH:mm:ss'), itinerary_id]
    );

    // Commit the transaction
    await connection.commit();
    connection.release();

    res.status(200).json({ 
      message: 'Itinerary items updated successfully',
      updated_count: updates.length
    });

  } catch (err) {
    await connection.rollback();
    connection.release();
    console.error('Error updating itinerary items:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};

// Bulk delete itinerary items
const bulkDeleteItineraryItems = async (req, res) => {
  const { id: itinerary_id } = req.params;
  const { item_ids } = req.body;

  // Validate required fields
  if (!itinerary_id || !item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
    return res.status(400).json({ message: 'Itinerary ID and item_ids array are required' });
  }

  // Begin transaction for atomicity
  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    // Validate that the itinerary exists and belongs to the authenticated user
    const [itineraryCheck] = await connection.query(
      'SELECT itinerary_id, traveler_id FROM itinerary WHERE itinerary_id = ?',
      [itinerary_id]
    );

    if (itineraryCheck.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ message: 'Itinerary not found' });
    }

    // Optional: Add user authorization check here if you have req.user
    // if (req.user && req.user.id !== itineraryCheck[0].traveler_id) {
    //   await connection.rollback();
    //   connection.release();
    //   return res.status(403).json({ message: 'Unauthorized' });
    // }

    // Verify that all items belong to this itinerary
    const placeholders = item_ids.map(() => '?').join(',');
    const [itemsCheck] = await connection.query(
      `SELECT item_id FROM itinerary_items 
       WHERE item_id IN (${placeholders}) AND itinerary_id = ?`,
      [...item_ids, itinerary_id]
    );

    if (itemsCheck.length !== item_ids.length) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ message: 'One or more items not found in this itinerary' });
    }

    // Delete the items
    await connection.query(
      `DELETE FROM itinerary_items 
       WHERE item_id IN (${placeholders}) AND itinerary_id = ?`,
      [...item_ids, itinerary_id]
    );

    // Update the itinerary's updated_at timestamp
    await connection.query(
      'UPDATE itinerary SET updated_at = ? WHERE itinerary_id = ?',
      [dayjs().format('YYYY-MM-DD HH:mm:ss'), itinerary_id]
    );

    // Commit the transaction
    await connection.commit();
    connection.release();

    res.status(200).json({ 
      message: 'Itinerary items deleted successfully',
      deleted_count: item_ids.length
    });

  } catch (err) {
    await connection.rollback();
    connection.release();
    console.error('Error deleting itinerary items:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};

// Update single itinerary item (alternative to bulk update)
const updateItineraryItem = async (req, res) => {
  const { id: itinerary_id, item_id } = req.params;
  const { start_time, end_time, custom_note } = req.body;

  // Validate required fields
  if (!itinerary_id || !item_id || !start_time || !end_time) {
    return res.status(400).json({ message: 'Itinerary ID, item ID, start time, and end time are required' });
  }

  // Begin transaction for atomicity
  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    // Validate time format (HH:MM or HH:MM:SS)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
    
    if (!timeRegex.test(start_time) || !timeRegex.test(end_time)) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ message: 'Invalid time format. Use HH:MM or HH:MM:SS' });
    }

    // Validate that start_time is before end_time
    const startTimeDate = dayjs(`2000-01-01 ${start_time}`);
    const endTimeDate = dayjs(`2000-01-01 ${end_time}`);
    
    if (startTimeDate.isAfter(endTimeDate) || startTimeDate.isSame(endTimeDate)) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ message: 'Start time must be before end time' });
    }

    // Verify that the item belongs to this itinerary
    const [itemCheck] = await connection.query(
      'SELECT item_id FROM itinerary_items WHERE item_id = ? AND itinerary_id = ?',
      [item_id, itinerary_id]
    );

    if (itemCheck.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ message: 'Itinerary item not found' });
    }

    // Update the item
    await connection.query(
      `UPDATE itinerary_items 
       SET start_time = ?, end_time = ?, custom_note = ?, updated_at = ?
       WHERE item_id = ? AND itinerary_id = ?`,
      [start_time, end_time, custom_note || '', dayjs().format('YYYY-MM-DD HH:mm:ss'), item_id, itinerary_id]
    );

    // Update the itinerary's updated_at timestamp
    await connection.query(
      'UPDATE itinerary SET updated_at = ? WHERE itinerary_id = ?',
      [dayjs().format('YYYY-MM-DD HH:mm:ss'), itinerary_id]
    );

    // Commit the transaction
    await connection.commit();
    connection.release();

    res.status(200).json({ 
      message: 'Itinerary item updated successfully'
    });

  } catch (err) {
    await connection.rollback();
    connection.release();
    console.error('Error updating itinerary item:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};

// Delete single itinerary item (alternative to bulk delete)
const deleteItineraryItem = async (req, res) => {
  const { id: itinerary_id, item_id } = req.params;

  // Validate required fields
  if (!itinerary_id || !item_id) {
    return res.status(400).json({ message: 'Itinerary ID and item ID are required' });
  }

  // Begin transaction for atomicity
  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    // Verify that the item belongs to this itinerary
    const [itemCheck] = await connection.query(
      'SELECT item_id FROM itinerary_items WHERE item_id = ? AND itinerary_id = ?',
      [item_id, itinerary_id]
    );

    if (itemCheck.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ message: 'Itinerary item not found' });
    }

    // Delete the item
    await connection.query(
      'DELETE FROM itinerary_items WHERE item_id = ? AND itinerary_id = ?',
      [item_id, itinerary_id]
    );

    // Update the itinerary's updated_at timestamp
    await connection.query(
      'UPDATE itinerary SET updated_at = ? WHERE itinerary_id = ?',
      [dayjs().format('YYYY-MM-DD HH:mm:ss'), itinerary_id]
    );

    // Commit the transaction
    await connection.commit();
    connection.release();

    res.status(200).json({ 
      message: 'Itinerary item deleted successfully'
    });

  } catch (err) {
    await connection.rollback();
    connection.release();
    console.error('Error deleting itinerary item:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};

module.exports = {
  bulkUpdateItineraryItems,
  bulkDeleteItineraryItems,
  updateItineraryItem,
  deleteItineraryItem
};