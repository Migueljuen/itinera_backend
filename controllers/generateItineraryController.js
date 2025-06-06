const dayjs = require('dayjs');
const db = require('../config/db.js');
const path = require('path');


const generateItinerary = async (req, res) => {
  const { 
    traveler_id, 
    city,
    start_date, 
    end_date, 
    experience_types,
    travel_companion, 
    explore_time, 
    budget,
    activity_intensity, // NEW FIELD: 'low', 'moderate', 'high'
    title,
    notes
  } = req.body;

  // Debug: Log the entire request body
  console.log('Request body received:', JSON.stringify(req.body, null, 2));

  // Validate required fields (including new activity_intensity)
  if (!traveler_id || !start_date || !end_date || !experience_types || 
      !travel_companion || !explore_time || !budget || !activity_intensity) {
    return res.status(400).json({ 
      message: 'All preference fields are required for itinerary generation',
      missing_fields: {
        traveler_id: !traveler_id,
        start_date: !start_date,
        end_date: !end_date,
        experience_types: !experience_types,
        travel_companion: !travel_companion,
        explore_time: !explore_time,
        budget: !budget,
        activity_intensity: !activity_intensity
      }
    });
  }

  // Validate activity_intensity values
  const validIntensities = ['low', 'moderate', 'high'];
  if (!validIntensities.includes(activity_intensity.toLowerCase())) {
    return res.status(400).json({ 
      message: 'Invalid activity_intensity. Must be: low, moderate, or high' 
    });
  }

  try {
    const startDate = dayjs(start_date);
    const endDate = dayjs(end_date);

    if (startDate.isAfter(endDate)) {
      return res.status(400).json({ message: 'Start date cannot be after end date' });
    }

    const totalDays = endDate.diff(startDate, 'day') + 1;

    // Step 1: Get suitable experiences based on preferences
    const experiences = await getFilteredExperiences({
      city,
      experience_types,
      travel_companion,
      explore_time,
      budget,
      start_date,
      end_date
    });

    console.log('Found experiences:', experiences.length);

    if (experiences.length === 0) {
      return res.status(404).json({ message: 'No suitable experiences found for your preferences' });
    }

    // Step 2: Generate smart itinerary distribution with activity intensity
    const generatedItinerary = await smartItineraryGeneration({
      experiences,
      totalDays,
      experience_types,
      explore_time,
      travel_companion,
      activity_intensity // Pass the new parameter
    });

    // Continue with existing itinerary creation logic...
    const itineraryTitle = title || `${city || 'Adventure'} - ${startDate.format('MMM DD')} to ${endDate.format('MMM DD, YYYY')}`;
    
    const [result] = await db.query(
      `INSERT INTO itinerary (traveler_id, start_date, end_date, title, notes, created_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [traveler_id, start_date, end_date, itineraryTitle, notes || 'Auto-generated itinerary', dayjs().format('YYYY-MM-DD HH:mm:ss'), 'upcoming']
    );

    const itinerary_id = result.insertId;

    // Step 4: Insert itinerary items
    if (generatedItinerary.length > 0) {
      const itemValues = generatedItinerary.map(item => [
        itinerary_id,
        item.experience_id,
        item.day_number,
        item.start_time,
        item.end_time,
        item.auto_note || '',
        dayjs().format('YYYY-MM-DD HH:mm:ss'),
        dayjs().format('YYYY-MM-DD HH:mm:ss')
      ]);

      await db.query(
        `INSERT INTO itinerary_items 
          (itinerary_id, experience_id, day_number, start_time, end_time, custom_note, created_at, updated_at)
         VALUES ?`,
        [itemValues]
      );
    }

    // Step 5: Return generated itinerary with full details
    const fullItinerary = await getItineraryWithDetails(itinerary_id);

    res.status(201).json({ 
      message: 'Itinerary generated successfully',
      itinerary_id,
      itineraries: [fullItinerary],
      total_experiences: experiences.length,
      selected_experiences: generatedItinerary.length,
      activity_intensity: activity_intensity
    });

  } catch (err) {
    console.error('Error generating itinerary:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};
// Function 1: Generate itinerary (preview only)
const itineraryPreview = async (req, res) => {
  const { 
    city,
    start_date, 
    end_date, 
    experience_types,
    travel_companion, 
    explore_time, 
    budget,
    activity_intensity,
    title
  } = req.body;

  // Debug: Log the entire request body
  console.log('Request body received:', JSON.stringify(req.body, null, 2));

  // Validate required fields
  if (!start_date || !end_date || !experience_types || 
      !travel_companion || !explore_time || !budget || !activity_intensity) {
    return res.status(400).json({ 
      message: 'All preference fields are required for itinerary generation',
      missing_fields: {
        start_date: !start_date,
        end_date: !end_date,
        experience_types: !experience_types,
        travel_companion: !travel_companion,
        explore_time: !explore_time,
        budget: !budget,
        activity_intensity: !activity_intensity
      }
    });
  }

  // Validate activity_intensity values
  const validIntensities = ['low', 'moderate', 'high'];
  if (!validIntensities.includes(activity_intensity.toLowerCase())) {
    return res.status(400).json({ 
      message: 'Invalid activity_intensity. Must be: low, moderate, or high' 
    });
  }

  try {
    const startDate = dayjs(start_date);
    const endDate = dayjs(end_date);

    if (startDate.isAfter(endDate)) {
      return res.status(400).json({ message: 'Start date cannot be after end date' });
    }

    const totalDays = endDate.diff(startDate, 'day') + 1;

    // Step 1: Get suitable experiences based on preferences
    const experiences = await getFilteredExperiences({
      city,
      experience_types,
      travel_companion,
      explore_time,
      budget,
      start_date,
      end_date
    });

    console.log('Found experiences:', experiences.length);

    if (experiences.length === 0) {
      return res.status(404).json({ message: 'No suitable experiences found for your preferences' });
    }

    // Step 2: Generate smart itinerary distribution with activity intensity
    const generatedItinerary = await smartItineraryGeneration({
      experiences,
      totalDays,
      experience_types,
      explore_time,
      travel_companion,
      activity_intensity
    });

    // Generate title for preview
    const itineraryTitle = title || `${city || 'Adventure'} - ${startDate.format('MMM DD')} to ${endDate.format('MMM DD, YYYY')}`;
    
    // Return generated itinerary for preview (NOT SAVED)
    res.status(200).json({ 
      message: 'Itinerary generated successfully',
      preview: true,
      itinerary_data: {
        title: itineraryTitle,
        start_date,
        end_date,
        items: generatedItinerary,
        total_experiences: experiences.length,
        selected_experiences: generatedItinerary.length,
        activity_intensity: activity_intensity
      }
    });

  } catch (err) {
    console.error('Error generating itinerary preview:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};

// Helper function to filter experiences based on preferences - FIXED VERSION
const getFilteredExperiences = async ({
  city, // Now optional
  experience_types,
  travel_companion,
  explore_time,
  budget,
  start_date,
  end_date
}) => {
  try {
    console.log('Filtering experiences with params:', {
      city,
      experience_types,
      travel_companion,
      explore_time,
      budget
    });

    // Calculate trip day names for availability filtering (FIXED VERSION)
    let tripDayNames = [];
    if (start_date && end_date) {
      try {
        // Parse both dates consistently
        const [startYear, startMonth, startDay] = start_date.split('-');
        const [endYear, endMonth, endDay] = end_date.split('-');
        
        const startDate = new Date(parseInt(startYear), parseInt(startMonth) - 1, parseInt(startDay));
        const endDate = new Date(parseInt(endYear), parseInt(endMonth) - 1, parseInt(endDay));
        
        console.log('Date range:', { 
          start_date, 
          end_date, 
          startDate: startDate.toDateString(), 
          endDate: endDate.toDateString() 
        });
        
        const tripDaysOfWeek = [];
        const currentDate = new Date(startDate);
        
        // Add safety check to prevent infinite loop
        let dayCount = 0;
        const maxDays = 365;
        
        while (currentDate <= endDate && dayCount < maxDays) {
          tripDaysOfWeek.push(currentDate.getDay());
          currentDate.setDate(currentDate.getDate() + 1);
          dayCount++;
        }
        
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        tripDayNames = [...new Set(tripDaysOfWeek.map(dayNum => dayNames[dayNum]))];
        
        console.log('Trip days of week (numbers):', tripDaysOfWeek);
        console.log('Trip day names:', tripDayNames);
        
      } catch (error) {
        console.error('Error calculating trip day names:', error);
        tripDayNames = []; // Default to empty array on error
      }
    }

    console.log('Trip day names:', tripDayNames);

    // First, let's check if we have any experiences at all
    const [allExperiences] = await db.query(`
      SELECT COUNT(*) as total FROM experience WHERE status = 'active'
    `);
    console.log('Total active experiences in database:', allExperiences[0].total);

    // Build the main query similar to getAllExperience
    let query = `
      SELECT 
        e.experience_id,
        e.creator_id,
        e.destination_id,
        e.title,
        e.description,
        e.price,
        e.unit,
        e.status,
        e.travel_companion,
        e.created_at,
        d.name as destination_name,
        d.city,
        GROUP_CONCAT(DISTINCT t.name) as tag_names,
        GROUP_CONCAT(DISTINCT t.tag_id) as tag_ids
      FROM experience e
      JOIN destination d ON e.destination_id = d.destination_id
      LEFT JOIN experience_tags et ON e.experience_id = et.experience_id
      LEFT JOIN tags t ON et.tag_id = t.tag_id
      LEFT JOIN experience_availability a ON e.experience_id = a.experience_id
      LEFT JOIN availability_time_slots ts ON a.availability_id = ts.availability_id
      WHERE e.status = 'active'
    `;

    const queryParams = [];
    const conditions = ['e.status = ?'];
    queryParams.push('active');

    // Filter by city only if provided
    if (city && city.trim()) {
      conditions.push('LOWER(d.city) LIKE ?');
      queryParams.push(`%${city.trim().toLowerCase()}%`);
    }

    // Filter by travel companion - handle case sensitivity and exact matching
    if (travel_companion && travel_companion !== 'Any') {
      conditions.push('LOWER(e.travel_companion) = LOWER(?)');
      queryParams.push(travel_companion.trim());
    }

    // Add date filter if we have trip days
    if (tripDayNames.length > 0) {
      conditions.push(`e.experience_id IN (
        SELECT DISTINCT ea.experience_id 
        FROM experience_availability ea 
        WHERE ea.day_of_week IN (${tripDayNames.map(() => '?').join(',')})
      )`);
      queryParams.push(...tripDayNames);
    }

    // Filter by explore time
    if (explore_time && explore_time !== 'Both') {
      switch (explore_time.toLowerCase()) {
        case 'daytime':
          conditions.push('HOUR(ts.start_time) < 20');
          break;
        case 'nighttime':
          conditions.push('HOUR(ts.start_time) >= 16');
          break;
      }
    }

    // Filter by budget - Updated to match getAllExperience logic
    if (budget && budget !== 'Any') {
      switch (budget.toLowerCase()) {
        case 'free':
          conditions.push('e.price = 0');
          break;
        case 'budget-friendly':
          conditions.push('e.price <= 500');
          break;
        case 'mid-range':
          conditions.push('e.price <= 2000');
          break;
        case 'premium':
          conditions.push('e.price > 2000');
          break;
      }
    }

    // Build the WHERE clause
    if (conditions.length > 0) {
      query += ` AND ${conditions.slice(1).join(' AND ')}`; // Skip the first condition since it's already in WHERE
    }

    // Group by to handle the aggregated fields
    query += ` GROUP BY e.experience_id, e.creator_id, e.destination_id, e.title, e.description, 
               e.price, e.unit, e.status, e.travel_companion, e.created_at,
               d.name, d.city`;

    // Filter by experience types after grouping if provided
    if (experience_types && experience_types.length > 0) {
      query += ` HAVING (`;
      const tagConditions = experience_types.map((type, index) => {
        queryParams.push(`%${type}%`);
        return `tag_names LIKE ?`;
      });
      query += tagConditions.join(' OR ');
      query += `)`;
    }

    query += ` ORDER BY e.created_at DESC`;

    console.log('Generated Query:', query);
    console.log('Query Parameters:', queryParams);

    // Execute the main query
    const [experiences] = await db.query(query, queryParams);
    console.log('Initial experiences found:', experiences.length);

    // Add images to each experience
    const processedExperiences = [];
    for (const experience of experiences) {
      const [images] = await db.query(`
        SELECT image_url FROM experience_images 
        WHERE experience_id = ? 
        LIMIT 1
      `, [experience.experience_id]);

      processedExperiences.push({
        ...experience,
        tag_names: experience.tag_names ? experience.tag_names.split(',') : [],
        tag_ids: experience.tag_ids ? experience.tag_ids.split(',').map(Number) : [],
        image_url: images.length > 0 ? images[0].image_url : null
      });
    }

    console.log('Final processed experiences:', processedExperiences.length);
    return processedExperiences;

  } catch (error) {
    console.error('Error filtering experiences:', error);
    throw error;
  }
};

// Helper function to check experience availability - SIMPLIFIED
const checkExperienceAvailability = async (experience_id, start_date, end_date, explore_time) => {
  try {
    const [availability] = await db.query(`
      SELECT day_of_week, start_time, end_time
      FROM experience_availability
      WHERE experience_id = ?
    `, [experience_id]);

    // If no availability records, assume it's available (or set default policy)
    if (availability.length === 0) {
      console.log(`No availability records for experience ${experience_id}, defaulting to available`);
      return true;
    }

    // Check if experience matches explore_time preference
    const hasMatchingTimeSlots = availability.some(slot => {
      const startHour = parseInt(slot.start_time.split(':')[0]);
      const endHour = parseInt(slot.end_time.split(':')[0]);
      
      const isDaytime = startHour >= 6 && endHour <= 18;
      const isNighttime = startHour >= 18 || endHour <= 6;
      
      switch (explore_time) {
        case 'Daytime':
          return isDaytime;
        case 'Nighttime':
          return isNighttime;
        case 'Both':
        default:
          return true;
      }
    });

    return hasMatchingTimeSlots;

  } catch (error) {
    console.error('Error checking availability:', error);
    // Default to available on error to prevent blocking all experiences
    return true;
  }
};

// Smart itinerary generation algorithm - FIXED VERSION
// Updated Smart itinerary generation with activity intensity
const smartItineraryGeneration = async ({
  experiences,
  totalDays,
  experience_types,
  explore_time,
  travel_companion,
  activity_intensity
}) => {
  const itineraryItems = [];
  
  // Define experiences per day based on activity intensity
  const getExperiencesPerDay = (intensity, totalExperiences, totalDays) => {
    let targetPerDay;
    
    switch (intensity.toLowerCase()) {
      case 'low':
        targetPerDay = Math.min(4, Math.random() < 0.5 ? 3 : 4); // 3-4 experiences
        break;
      case 'moderate':
        targetPerDay = Math.min(6, Math.floor(Math.random() * 2) + 5); // 5-6 experiences
        break;
      case 'high':
        targetPerDay = Math.max(6, Math.min(8, Math.floor(Math.random() * 3) + 6)); // 6-8 experiences
        break;
      default:
        targetPerDay = Math.ceil(totalExperiences / totalDays); // fallback to even distribution
    }
    
    // Ensure we don't exceed available experiences
    const maxPossible = Math.ceil(totalExperiences / totalDays);
    return Math.min(targetPerDay, maxPossible);
  };

  console.log(`Generating itinerary for ${totalDays} days with ${experiences.length} experiences`);
  console.log(`Activity intensity: ${activity_intensity}`);

  const baseExperiencesPerDay = getExperiencesPerDay(activity_intensity, experiences.length, totalDays);
  console.log(`Target experiences per day: ${baseExperiencesPerDay}`);

  // If we don't have experience types to categorize, distribute based on intensity
  if (!experience_types || experience_types.length === 0) {
    let experienceIndex = 0;
    
    for (let day = 1; day <= totalDays && experienceIndex < experiences.length; day++) {
      const experiencesForDay = Math.min(
        baseExperiencesPerDay, 
        experiences.length - experienceIndex
      );
      
      for (let i = 0; i < experiencesForDay && experienceIndex < experiences.length; i++) {
        const exp = experiences[experienceIndex];
        const timeSlot = generateTimeSlot(exp, explore_time, i);
        
        itineraryItems.push({
          experience_id: exp.experience_id,
          day_number: day,
          start_time: timeSlot.start_time,
          end_time: timeSlot.end_time,
          auto_note: `Auto-scheduled: ${exp.title || 'Experience'}`
        });
        
        experienceIndex++;
      }
    }
    
    return itineraryItems;
  }

  // Categorize experiences by type
  const categorizedExperiences = {};
  experience_types.forEach(type => {
    categorizedExperiences[type] = experiences.filter(exp => 
      exp.tag_names && exp.tag_names.some(tag => 
        tag.toLowerCase().includes(type.toLowerCase())
      )
    );
  });

  // Add uncategorized experiences
  const categorizedIds = new Set();
  Object.values(categorizedExperiences).forEach(categoryExps => {
    categoryExps.forEach(exp => categorizedIds.add(exp.experience_id));
  });
  
  const uncategorizedExperiences = experiences.filter(exp => 
    !categorizedIds.has(exp.experience_id)
  );
  
  if (uncategorizedExperiences.length > 0) {
    categorizedExperiences['Other'] = uncategorizedExperiences;
  }

  console.log('Categorized experiences:', Object.keys(categorizedExperiences).map(key => 
    `${key}: ${categorizedExperiences[key].length}`
  ));

  // Distribute experiences across days based on intensity
  const availableExperiences = [...experiences];
  let usedExperiences = new Set();
  
  for (let day = 1; day <= totalDays; day++) {
    // Calculate experiences for this specific day based on intensity
    let experiencesForThisDay;
    
    switch (activity_intensity.toLowerCase()) {
      case 'low':
        experiencesForThisDay = Math.min(
          Math.floor(Math.random() * 2) + 3, // 3-4 random
          Math.ceil((experiences.length - usedExperiences.size) / (totalDays - day + 1))
        );
        break;
      case 'moderate':
        experiencesForThisDay = Math.min(
          Math.floor(Math.random() * 2) + 5, // 5-6 random
          Math.ceil((experiences.length - usedExperiences.size) / (totalDays - day + 1))
        );
        break;
      case 'high':
        experiencesForThisDay = Math.min(
          Math.floor(Math.random() * 3) + 6, // 6-8 random
          Math.ceil((experiences.length - usedExperiences.size) / (totalDays - day + 1))
        );
        break;
      default:
        experiencesForThisDay = baseExperiencesPerDay;
    }
    
    console.log(`Day ${day}: Planning ${experiencesForThisDay} experiences`);
    
    const dayExperiences = [];
    const categoryKeys = Object.keys(categorizedExperiences);
    let selectedCount = 0;
    let categoryIndex = (day - 1) % categoryKeys.length;

    // Select experiences for this day
    while (selectedCount < experiencesForThisDay && usedExperiences.size < experiences.length) {
      let experienceSelected = false;

      // Try each category in rotation for variety
      for (let i = 0; i < categoryKeys.length && selectedCount < experiencesForThisDay; i++) {
        const currentCategoryIndex = (categoryIndex + i) % categoryKeys.length;
        const category = categoryKeys[currentCategoryIndex];
        
        const availableFromCategory = categorizedExperiences[category].filter(exp => 
          !usedExperiences.has(exp.experience_id)
        );

        if (availableFromCategory.length > 0) {
          const selectedExp = availableFromCategory[0];
          const timeSlot = generateTimeSlot(selectedExp, explore_time, selectedCount);
          
          dayExperiences.push({
            experience_id: selectedExp.experience_id,
            day_number: day,
            start_time: timeSlot.start_time,
            end_time: timeSlot.end_time,
            auto_note: `Auto-scheduled: ${selectedExp.title || 'Experience'} (${category})`
          });

          usedExperiences.add(selectedExp.experience_id);
          selectedCount++;
          experienceSelected = true;
        }
      }

      // Fallback: select any remaining experience
      if (!experienceSelected) {
        const remainingExps = availableExperiences.filter(exp => 
          !usedExperiences.has(exp.experience_id)
        );
        
        if (remainingExps.length > 0) {
          const selectedExp = remainingExps[0];
          const timeSlot = generateTimeSlot(selectedExp, explore_time, selectedCount);
          
          dayExperiences.push({
            experience_id: selectedExp.experience_id,
            day_number: day,
            start_time: timeSlot.start_time,
            end_time: timeSlot.end_time,
            auto_note: `Auto-scheduled: ${selectedExp.title || 'Experience'}`
          });

          usedExperiences.add(selectedExp.experience_id);
          selectedCount++;
        } else {
          break; // No more experiences available
        }
      }
    }

    itineraryItems.push(...dayExperiences);
    console.log(`Day ${day}: Added ${dayExperiences.length} experiences`);
    
    // Early exit if no more experiences available
    if (usedExperiences.size >= experiences.length) {
      console.log(`All ${experiences.length} experiences have been allocated`);
      break;
    }
  }

  console.log(`Generated ${itineraryItems.length} itinerary items total`);
  console.log(`Used ${usedExperiences.size} out of ${experiences.length} available experiences`);
  
  return itineraryItems;
};



// Generate appropriate time slots for experiences - UNCHANGED
const generateTimeSlot = (experience, explore_time, slotIndex) => {
  const timeSlots = {
    'Daytime': [
      { start: '08:00', end: '09:30' },
      { start: '10:00', end: '11:30' },
      { start: '12:00', end: '13:30' },
      { start: '14:00', end: '15:30' },
      { start: '16:00', end: '17:30' },
      { start: '18:00', end: '19:00' }
    ],
    'Nighttime': [
      { start: '18:00', end: '19:30' },
      { start: '20:00', end: '21:30' },
      { start: '22:00', end: '23:30' },
      { start: '19:30', end: '21:00' },
      { start: '21:30', end: '23:00' },
      { start: '23:30', end: '01:00' }
    ],
    'Both': [
      { start: '09:00', end: '10:30' },
      { start: '11:00', end: '12:30' },
      { start: '14:00', end: '15:30' },
      { start: '16:00', end: '17:30' },
      { start: '18:00', end: '19:30' },
      { start: '20:00', end: '21:30' },
      { start: '22:00', end: '23:00' },
      { start: '12:30', end: '14:00' }
    ]
  };

  const slots = timeSlots[explore_time] || timeSlots['Both'];
  const selectedSlot = slots[slotIndex % slots.length];

  return {
    start_time: selectedSlot.start,
    end_time: selectedSlot.end
  };
};
// Get full itinerary details for response - UNCHANGED
const getItineraryWithDetails = async (itinerary_id) => {
  try {
    // Get itinerary basic info
    const [itineraryInfo] = await db.query(`
      SELECT * FROM itinerary WHERE itinerary_id = ?
    `, [itinerary_id]);

    if (itineraryInfo.length === 0) return null;

    // Get itinerary items with experience details and images
    const [items] = await db.query(`
      SELECT 
        ROW_NUMBER() OVER (ORDER BY ii.day_number, ii.start_time) as item_id,
        ii.experience_id,
        ii.day_number,
        ii.start_time,
        ii.end_time,
        ii.custom_note,
        ii.created_at,
        ii.updated_at,
        e.title as experience_name,
        e.description as experience_description,
        e.price,
        e.unit,
        d.name as destination_name,
        d.city as destination_city,
        GROUP_CONCAT(ei.image_url) as all_images
      FROM itinerary_items ii
      JOIN experience e ON ii.experience_id = e.experience_id
      JOIN destination d ON e.destination_id = d.destination_id
      LEFT JOIN experience_images ei ON e.experience_id = ei.experience_id
      WHERE ii.itinerary_id = ?
      GROUP BY ii.experience_id, ii.day_number, ii.start_time, ii.end_time, 
               ii.custom_note, ii.created_at, ii.updated_at,
               e.title, e.description, e.price, e.unit,
               d.name, d.city
      ORDER BY ii.day_number, ii.start_time
    `, [itinerary_id]);

    // Process items to match expected format
    const processedItems = items.map(item => {
      const images = item.all_images ? item.all_images.split(',').filter(img => img) : [];
      
      return {
        item_id: item.item_id,
        experience_id: item.experience_id,
        day_number: item.day_number,
        start_time: item.start_time,
        end_time: item.end_time,
        custom_note: item.custom_note || '',
        created_at: item.created_at,
        updated_at: item.updated_at,
        experience_name: item.experience_name,
        experience_description: item.experience_description,
        destination_name: item.destination_name,
        destination_city: item.destination_city,
        images: images,
        primary_image: images.length > 0 ? images[0] : null,
        price: item.price,
        unit: item.unit
      };
    });

    return {
      itinerary_id: itineraryInfo[0].itinerary_id,
      traveler_id: itineraryInfo[0].traveler_id,
      start_date: itineraryInfo[0].start_date,
      end_date: itineraryInfo[0].end_date,
      title: itineraryInfo[0].title,
      notes: itineraryInfo[0].notes,
      created_at: itineraryInfo[0].created_at,
      status: itineraryInfo[0].status,
      items: processedItems
    };

  } catch (error) {
    console.error('Error getting itinerary details:', error);
    throw error;
  }
};

module.exports = { generateItinerary };