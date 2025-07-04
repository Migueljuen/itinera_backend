const db = require('../config/db.js');
const dayjs = require('dayjs');
const notificationService = require('../services/notificationService');

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
      'SELECT itinerary_id, traveler_id, title FROM itinerary WHERE itinerary_id = ?',
      [itinerary_id]
    );

    if (itineraryCheck.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ message: 'Itinerary not found' });
    }

    const itinerary = itineraryCheck[0];
    const traveler_id = itinerary.traveler_id;

    // Optional: Add user authorization check here if you have req.user
    // if (req.user && req.user.id !== itinerary.traveler_id) {
    //   await connection.rollback();
    //   connection.release();
    //   return res.status(403).json({ message: 'Unauthorized' });
    // }

    // Store original item details for comparison
    const itemIds = updates.map(u => u.item_id);
    const placeholders = itemIds.map(() => '?').join(',');
    const [originalItems] = await connection.query(
      `SELECT ii.*, e.title as experience_name, d.name as destination_name
       FROM itinerary_items ii
       JOIN experience e ON ii.experience_id = e.experience_id
       LEFT JOIN destination d ON e.destination_id = d.destination_id
       WHERE ii.item_id IN (${placeholders}) AND ii.itinerary_id = ?`,
      [...itemIds, itinerary_id]
    );

    // Create a map of original items for easy lookup
    const originalItemsMap = {};
    originalItems.forEach(item => {
      originalItemsMap[item.item_id] = item;
    });

    // Track significant changes
    const significantChanges = [];

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

      // Check for significant time changes
      const original = originalItemsMap[item_id];
      if (original) {
        const originalStartTime = original.start_time;
        const originalEndTime = original.end_time;
        
        if (originalStartTime !== start_time || originalEndTime !== end_time) {
          significantChanges.push({
            item_id,
            experience_name: original.experience_name,
            destination_name: original.destination_name,
            day_number: original.day_number,
            old_start_time: originalStartTime,
            old_end_time: originalEndTime,
            new_start_time: start_time,
            new_end_time: end_time
          });
        }
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

    // Send notifications for significant changes
    try {
      // General update notification
      await notificationService.createNotification({
        user_id: traveler_id,
        type: 'update',
        title: 'Itinerary Updated',
        description: `Your "${itinerary.title}" itinerary has been updated with ${updates.length} changes.`,
        itinerary_id: parseInt(itinerary_id),
        icon: 'sync-outline',
        icon_color: '#F59E0B',
        created_at: dayjs().format('YYYY-MM-DD HH:mm:ss')
      });

      // Specific notifications for time changes
      for (const change of significantChanges) {
        const formatTime = (time) => {
          const [hours, minutes] = time.split(':');
          const hour = parseInt(hours);
          const ampm = hour >= 12 ? 'PM' : 'AM';
          const displayHour = hour % 12 || 12;
          return `${displayHour}:${minutes} ${ampm}`;
        };

        await notificationService.createNotification({
          user_id: traveler_id,
          type: 'alert',
          title: 'Activity Time Changed',
          description: `${change.experience_name} on Day ${change.day_number} has been rescheduled from ${formatTime(change.old_start_time)} to ${formatTime(change.new_start_time)}.`,
          itinerary_id: parseInt(itinerary_id),
          itinerary_item_id: change.item_id,
          icon: 'time-outline',
          icon_color: '#EF4444',
          created_at: dayjs().format('YYYY-MM-DD HH:mm:ss')
        });

        // Check if the activity is happening soon (within 24 hours)
        const [itineraryDates] = await db.query(
          'SELECT start_date FROM itinerary WHERE itinerary_id = ?',
          [itinerary_id]
        );
        
        if (itineraryDates.length > 0) {
          const activityDate = dayjs(itineraryDates[0].start_date).add(change.day_number - 1, 'day');
          const activityDateTime = activityDate.hour(parseInt(change.new_start_time.split(':')[0])).minute(parseInt(change.new_start_time.split(':')[1]));
          const hoursUntilActivity = activityDateTime.diff(dayjs(), 'hour');
          
          if (hoursUntilActivity > 0 && hoursUntilActivity <= 24) {
            await notificationService.createNotification({
              user_id: traveler_id,
              type: 'reminder',
              title: 'Activity Starting Soon',
              description: `Reminder: ${change.experience_name} is now scheduled for ${formatTime(change.new_start_time)} (in ${hoursUntilActivity} hours).`,
              itinerary_id: parseInt(itinerary_id),
              itinerary_item_id: change.item_id,
              icon: 'alert-circle-outline',
              icon_color: '#3B82F6',
              created_at: dayjs().format('YYYY-MM-DD HH:mm:ss')
            });
          }
        }
      }
    } catch (notificationError) {
      console.error('Error creating notifications:', notificationError);
      // Don't fail the request if notifications fail
    }

    res.status(200).json({ 
      message: 'Itinerary items updated successfully',
      updated_count: updates.length,
      significant_changes: significantChanges.length
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
      'SELECT itinerary_id, traveler_id, title FROM itinerary WHERE itinerary_id = ?',
      [itinerary_id]
    );

    if (itineraryCheck.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ message: 'Itinerary not found' });
    }

    const itinerary = itineraryCheck[0];
    const traveler_id = itinerary.traveler_id;

    // Optional: Add user authorization check here if you have req.user
    // if (req.user && req.user.id !== itinerary.traveler_id) {
    //   await connection.rollback();
    //   connection.release();
    //   return res.status(403).json({ message: 'Unauthorized' });
    // }

    // Get details of items being deleted for notification
    const placeholders = item_ids.map(() => '?').join(',');
    const [itemsToDelete] = await connection.query(
      `SELECT ii.*, e.title as experience_name, d.name as destination_name
       FROM itinerary_items ii
       JOIN experience e ON ii.experience_id = e.experience_id
       LEFT JOIN destination d ON e.destination_id = d.destination_id
       WHERE ii.item_id IN (${placeholders}) AND ii.itinerary_id = ?`,
      [...item_ids, itinerary_id]
    );

    if (itemsToDelete.length !== item_ids.length) {
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

    // Send notifications for deleted items
    try {
      // General deletion notification
      await notificationService.createNotification({
        user_id: traveler_id,
        type: 'update',
        title: 'Activities Removed',
        description: `${item_ids.length} ${item_ids.length === 1 ? 'activity has' : 'activities have'} been removed from your "${itinerary.title}" itinerary.`,
        itinerary_id: parseInt(itinerary_id),
        icon: 'trash-outline',
        icon_color: '#EF4444',
        created_at: dayjs().format('YYYY-MM-DD HH:mm:ss')
      });

      // If only a few items deleted, send specific notifications
      if (itemsToDelete.length <= 3) {
        for (const item of itemsToDelete) {
          await notificationService.createNotification({
            user_id: traveler_id,
            type: 'alert',
            title: 'Activity Cancelled',
            description: `"${item.experience_name}" on Day ${item.day_number} has been removed from your itinerary.`,
            itinerary_id: parseInt(itinerary_id),
            icon: 'close-circle-outline',
            icon_color: '#EF4444',
            created_at: dayjs().format('YYYY-MM-DD HH:mm:ss')
          });
        }
      }
    } catch (notificationError) {
      console.error('Error creating notifications:', notificationError);
      // Don't fail the request if notifications fail
    }

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