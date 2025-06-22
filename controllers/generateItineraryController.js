const dayjs = require('dayjs');
const db = require('../config/db.js');
const path = require('path');
const { CITY_CENTERS, calculateDistanceFromCityCenter } = require('../utils/cityUtils');


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
    activity_intensity,
    travel_distance, // New field
    title,
    notes
  } = req.body;

  // Debug: Log the entire request body
  console.log('Request body received:', JSON.stringify(req.body, null, 2));

  // Validate required fields
  if (!traveler_id || !start_date || !end_date || !experience_types || 
      !travel_companion || !explore_time || !budget || !activity_intensity || !travel_distance) {
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
        activity_intensity: !activity_intensity,
        travel_distance: !travel_distance
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

  // Validate travel_distance values
  const validTravelDistances = ['nearby', 'moderate', 'far'];
  if (!validTravelDistances.includes(travel_distance.toLowerCase())) {
    return res.status(400).json({ 
      message: 'Invalid travel_distance. Must be: nearby, moderate, or far' 
    });
  }

  try {
    const startDate = dayjs(start_date);
    const endDate = dayjs(end_date);

    if (startDate.isAfter(endDate)) {
      return res.status(400).json({ message: 'Start date cannot be after end date' });
    }

    const totalDays = endDate.diff(startDate, 'day') + 1;

    // Step 1: Get suitable experiences based on preferences (including travel distance)
    const experiences = await getFilteredExperiences({
      city,
      experience_types,
      travel_companion,
      explore_time,
      budget,
      travel_distance, // Pass travel distance to filtering function
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
      activity_intensity,
      travel_distance, // Pass travel distance to generation function
      start_date 
    });

    const itineraryTitle = title || `${city || 'Adventure'} - ${startDate.format('MMM DD')} to ${endDate.format('MMM DD, YYYY')}`;

    // Create the itinerary object for preview/generation
    const previewItinerary = {
      // Use a temporary ID for preview (negative number to distinguish from real IDs)
      itinerary_id: -1,
      traveler_id,
      start_date,
      end_date,
      title: itineraryTitle,
      notes: notes || 'Auto-generated itinerary',
      created_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      status: 'preview',
      // Add experience details to each item for preview
      items: await Promise.all(generatedItinerary.map(async (item) => {
        // Get experience details
        const [experienceRows] = await db.query(
          `SELECT e.*, d.name as destination_name, d.city as destination_city,
                  GROUP_CONCAT(ei.image_url) as images
           FROM experience e
           LEFT JOIN destination d ON e.destination_id = d.destination_id
           LEFT JOIN experience_images ei ON e.experience_id = ei.experience_id
           WHERE e.experience_id = ?
           GROUP BY e.experience_id`,
          [item.experience_id]
        );

        const experience = experienceRows[0];
        const images = experience.images ? experience.images.split(',') : [];

        return {
          experience_id: item.experience_id,
          day_number: item.day_number,
          start_time: item.start_time,
          end_time: item.end_time,
          custom_note: item.auto_note || '',
          experience_name: experience.title,
          experience_description: experience.description,
          destination_name: experience.destination_name,
          destination_city: experience.destination_city,
          images: images,
          primary_image: images[0] || null,
          price: experience.price,
          unit: experience.unit
        };
      }))
    };

    return res.status(200).json({ 
      message: 'Itinerary generated successfully',
      itinerary_id: -1, // Temporary ID for preview
      itineraries: [previewItinerary],
      total_experiences: experiences.length,
      selected_experiences: generatedItinerary.length,
      activity_intensity: activity_intensity,
      travel_distance: travel_distance, // Include in response
      generated: true
    });

  } catch (err) {
    console.error('Error generating itinerary:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};

const saveItinerary = async (req, res) => {
  const {
    traveler_id,
    start_date,
    end_date,
    title,
    notes,
    items // Array of itinerary items from preview
  } = req.body;

  // Validate required fields
  if (!traveler_id || !start_date || !end_date || !title || !items || !Array.isArray(items)) {
    return res.status(400).json({ 
      message: 'Missing required fields for saving itinerary',
      required: ['traveler_id', 'start_date', 'end_date', 'title', 'items']
    });
  }

  try {
    // Step 1: Create the itinerary record
    const [result] = await db.query(
      `INSERT INTO itinerary (traveler_id, start_date, end_date, title, notes, created_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        traveler_id, 
        start_date, 
        end_date, 
        title, 
        notes || 'Auto-generated itinerary', 
        dayjs().format('YYYY-MM-DD HH:mm:ss'), 
        'upcoming'
      ]
    );

    const itinerary_id = result.insertId;

    // Step 2: Insert itinerary items
    if (items.length > 0) {
      const itemValues = items.map(item => [
        itinerary_id,
        item.experience_id,
        item.day_number,
        item.start_time,
        item.end_time,
        item.custom_note || '',
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

    // Step 3: Return the saved itinerary with full details
    const savedItinerary = await getItineraryWithDetails(itinerary_id);

    res.status(201).json({
      message: 'Itinerary saved successfully',
      itinerary_id,
      itinerary: savedItinerary
    });

  } catch (err) {
    console.error('Error saving itinerary:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};

// Enhanced helper function to get experience with its actual availability time slots
const getExperienceWithAvailability = async (experience_id, day_of_week) => {
  try {
    const [availability] = await db.query(`
      SELECT DISTINCT 
        ea.day_of_week, 
        ats.start_time, 
        ats.end_time,
        ea.availability_id
      FROM experience_availability ea
      JOIN availability_time_slots ats ON ea.availability_id = ats.availability_id
      WHERE ea.experience_id = ? AND ea.day_of_week = ?
      ORDER BY ats.start_time
    `, [experience_id, day_of_week]);

    return availability;
  } catch (error) {
    console.error('Error getting experience availability:', error);
    return [];
  }
};

// Helper function to check if two time slots conflict
const timeSlotConflict = (slot1, slot2) => {
  const start1 = convertTimeToMinutes(slot1.start_time);
  const end1 = convertTimeToMinutes(slot1.end_time);
  const start2 = convertTimeToMinutes(slot2.start_time);
  const end2 = convertTimeToMinutes(slot2.end_time);
  
  // Check if slots overlap (with a small buffer to prevent back-to-back scheduling)
  const buffer = 30; // 30 minutes buffer between activities
  return !(end1 + buffer <= start2 || end2 + buffer <= start1);
};

// Helper function to convert time string to minutes since midnight
const convertTimeToMinutes = (timeString) => {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
};

// Helper function to find non-conflicting time slot
const findNonConflictingSlot = (availableTimeSlots, scheduledSlotsForDay) => {
  // Sort available slots by start time for better scheduling
  const sortedSlots = [...availableTimeSlots].sort((a, b) => 
    convertTimeToMinutes(a.start_time) - convertTimeToMinutes(b.start_time)
  );
  
  for (const slot of sortedSlots) {
    let hasConflict = false;
    
    for (const scheduledSlot of scheduledSlotsForDay) {
      if (timeSlotConflict(slot, scheduledSlot)) {
        hasConflict = true;
        break;
      }
    }
    
    if (!hasConflict) {
      return slot;
    }
  }
  
  return null; // No non-conflicting slot found
};

// Enhanced smart itinerary generation with conflict detection
const smartItineraryGeneration = async ({
  experiences,
  totalDays,
  experience_types,
  explore_time,
  travel_companion,
  activity_intensity,
  travel_distance,
  start_date
}) => {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const itinerary = [];
  
  // Determine experiences per day based on activity intensity
  const experiencesPerDay = {
    'low': 2,
    'moderate': 3,
    'high': 4
  }[activity_intensity.toLowerCase()] || 2;

  // Parse start date to get day of week for each day
  const startDate = dayjs(start_date);
  
  console.log(`🗺️ Starting itinerary generation with inclusive ${travel_distance} travel distance preference`);
  console.log(`📊 Total experiences available: ${experiences.length}`);
  
  for (let day = 1; day <= totalDays; day++) {
    const currentDate = startDate.add(day - 1, 'day');
    const dayOfWeek = dayNames[currentDate.day()];
    
    console.log(`📅 Planning day ${day} (${dayOfWeek}) with ${travel_distance} travel distance preference`);
    
    // Keep track of scheduled time slots for this day to avoid conflicts
    const scheduledSlotsForDay = [];
    
    // Filter experiences available on this day of week with their time slots
    const availableExperiences = [];
    
    for (const experience of experiences) {
      const timeSlots = await getExperienceWithAvailability(experience.experience_id, dayOfWeek);
      
      if (timeSlots.length > 0) {
        // Filter time slots based on explore_time preference
        const filteredTimeSlots = timeSlots.filter(slot => {
          const startHour = parseInt(slot.start_time.split(':')[0]);
          
          switch (explore_time) {
            case 'Daytime':
              return startHour >= 6 && startHour < 18;
            case 'Nighttime':
              return startHour >= 18 || startHour < 6;
            case 'Both':
            default:
              return true;
          }
        });
        
        if (filteredTimeSlots.length > 0) {
          availableExperiences.push({
            ...experience,
            availableTimeSlots: filteredTimeSlots
          });
        }
      }
    }
    
    console.log(`✅ Available experiences for ${dayOfWeek}: ${availableExperiences.length}`);
    
    // Select experiences for this day (avoid duplicates across days)
    const usedExperienceIds = itinerary.map(item => item.experience_id);
    const unusedExperiences = availableExperiences.filter(
      exp => !usedExperienceIds.includes(exp.experience_id)
    );
    
    console.log(`🔄 Unused experiences for day ${day}: ${unusedExperiences.length}`);
    
    // Apply travel distance-based sorting/prioritization - INCLUSIVE APPROACH
    let sortedExperiences = [...unusedExperiences];
    
    if (travel_distance === 'nearby') {
      sortedExperiences.sort((a, b) => {
        const aDistance = parseFloat(a.distance_from_city_center) || 0;
        const bDistance = parseFloat(b.distance_from_city_center) || 0;
        return aDistance - bDistance;
      });
      console.log(`🎯 Prioritizing by shortest distances first (nearby preference - targeting ≤10km experiences)`);
      
    } else if (travel_distance === 'moderate') {
      sortedExperiences.sort((a, b) => {
        const aDistance = parseFloat(a.distance_from_city_center) || 0;
        const bDistance = parseFloat(b.distance_from_city_center) || 0;
        const randomFactor = (Math.random() - 0.5) * 3;
        return (aDistance - bDistance) + randomFactor;
      });
      console.log(`⚖️ Prioritizing with balanced mix (moderate preference - targeting ≤20km with variety)`);
      
    } else if (travel_distance === 'far') {
      const nearbyExps = sortedExperiences.filter(exp => (parseFloat(exp.distance_from_city_center) || 0) <= 10);
      const moderateExps = sortedExperiences.filter(exp => {
        const dist = parseFloat(exp.distance_from_city_center) || 0;
        return dist > 10 && dist <= 20;
      });
      const farExps = sortedExperiences.filter(exp => (parseFloat(exp.distance_from_city_center) || 0) > 20);
      const nullExps = sortedExperiences.filter(exp => !exp.distance_from_city_center);
      
      sortedExperiences = [
        ...farExps.sort(() => Math.random() - 0.5),
        ...moderateExps.sort(() => Math.random() - 0.5),
        ...nearbyExps.sort(() => Math.random() - 0.5),
        ...nullExps.sort(() => Math.random() - 0.5)
      ];
      
      console.log(`🌍 Prioritizing with full variety and exploration (far preference - all distances included)`);
    } else {
      sortedExperiences = sortedExperiences.sort(() => Math.random() - 0.5);
      console.log(`🎲 Using random shuffle (default behavior)`);
    }
    
    // Schedule experiences with conflict detection
    let scheduledCount = 0;
    let attemptCount = 0;
    const maxAttempts = sortedExperiences.length;
    
    while (scheduledCount < experiencesPerDay && attemptCount < maxAttempts) {
      const experience = sortedExperiences[attemptCount];
      
      if (!experience) {
        break;
      }
      
      // Find a non-conflicting time slot for this experience
      const nonConflictingSlot = findNonConflictingSlot(
        experience.availableTimeSlots, 
        scheduledSlotsForDay
      );
      
      if (nonConflictingSlot) {
        // Create detailed auto_note including travel distance context
        const distanceInfo = experience.distance_from_city_center 
          ? `${experience.distance_from_city_center}km from center`
          : 'distance unknown';
        
        const autoNote = `${experience.title} - ${dayOfWeek} at ${nonConflictingSlot.start_time}`;
        
        // Add to itinerary
        const itineraryItem = {
          experience_id: experience.experience_id,
          day_number: day,
          start_time: nonConflictingSlot.start_time,
          end_time: nonConflictingSlot.end_time,
          auto_note: autoNote
        };
        
        itinerary.push(itineraryItem);
        scheduledSlotsForDay.push(nonConflictingSlot);
        scheduledCount++;
        
        console.log(`➕ Added: ${experience.title} (${distanceInfo}) on day ${day} from ${nonConflictingSlot.start_time} to ${nonConflictingSlot.end_time}`);
      } else {
        console.log(`⚠️ Skipping ${experience.title} - no non-conflicting time slot available`);
      }
      
      attemptCount++;
    }
    
    if (scheduledCount < experiencesPerDay) {
      console.log(`⚠️ Warning: Only scheduled ${scheduledCount}/${experiencesPerDay} experiences for day ${day} due to time conflicts`);
    }
  }
  
  // Sort itinerary by day and time
  itinerary.sort((a, b) => {
    if (a.day_number !== b.day_number) {
      return a.day_number - b.day_number;
    }
    return a.start_time.localeCompare(b.start_time);
  });
  
  console.log(`🎉 Generated conflict-free itinerary with inclusive ${travel_distance} travel distance preference: ${itinerary.length} experiences total`);
  
  return itinerary;
};

// Corrected filtering function that properly joins with availability tables
const getFilteredExperiences = async ({
  city,
  experience_types,
  travel_companion,
  explore_time,
  budget,
  travel_distance, // New parameter
  start_date,
  end_date
}) => {
  try {
    console.log('Filtering experiences with params:', {
      city,
      experience_types,
      travel_companion,
      explore_time,
      budget,
      travel_distance // Log the new parameter
    });

    // Calculate trip day names for availability filtering
    let tripDayNames = [];
    if (start_date && end_date) {
      try {
        const [startYear, startMonth, startDay] = start_date.split('-');
        const [endYear, endMonth, endDay] = end_date.split('-');
        
        const startDate = new Date(parseInt(startYear), parseInt(startMonth) - 1, parseInt(startDay));
        const endDate = new Date(parseInt(endYear), parseInt(endMonth) - 1, parseInt(endDay));
        
        const tripDaysOfWeek = [];
        const currentDate = new Date(startDate);
        
        let dayCount = 0;
        const maxDays = 365;
        
        while (currentDate <= endDate && dayCount < maxDays) {
          tripDaysOfWeek.push(currentDate.getDay());
          currentDate.setDate(currentDate.getDate() + 1);
          dayCount++;
        }
        
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        tripDayNames = [...new Set(tripDaysOfWeek.map(dayNum => dayNames[dayNum]))];
        
        console.log('Trip day names:', tripDayNames);
        
      } catch (error) {
        console.error('Error calculating trip day names:', error);
        tripDayNames = [];
      }
    }

    // Build the main query with proper joins to availability tables
    let query = `
      SELECT DISTINCT
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
        d.latitude,
        d.longitude,
        d.distance_from_city_center,
        GROUP_CONCAT(DISTINCT t.name) as tag_names,
        GROUP_CONCAT(DISTINCT t.tag_id) as tag_ids
      FROM experience e
      JOIN destination d ON e.destination_id = d.destination_id
      LEFT JOIN experience_tags et ON e.experience_id = et.experience_id
      LEFT JOIN tags t ON et.tag_id = t.tag_id
      WHERE e.status = 'active'
    `;

    const queryParams = [];

    // FIXED: Case-insensitive city center lookup
    let selectedCityCenter = null;
    if (city && city.trim()) {
      // Try exact match first, then case-insensitive variations
      const cityKey = city.trim();
      selectedCityCenter = CITY_CENTERS[cityKey] || 
                          CITY_CENTERS[cityKey.toLowerCase()] || 
                          CITY_CENTERS[cityKey.charAt(0).toUpperCase() + cityKey.slice(1).toLowerCase()];
      
      if (!selectedCityCenter) {
        // Try all possible variations
        const cityVariations = [
          cityKey,
          cityKey.toLowerCase(), 
          cityKey.toUpperCase(),
          cityKey.charAt(0).toUpperCase() + cityKey.slice(1).toLowerCase(),
          // Handle common variations
          cityKey.replace(/\s+/g, ''), // Remove spaces
          cityKey.replace(/\s+/g, '').toLowerCase(),
          cityKey.replace(/\s+/g, '').charAt(0).toUpperCase() + cityKey.replace(/\s+/g, '').slice(1).toLowerCase()
        ];
        
        for (const variation of cityVariations) {
          if (CITY_CENTERS[variation]) {
            selectedCityCenter = CITY_CENTERS[variation];
            console.log(`✅ Found city center using variation: "${variation}" for input: "${city}"`);
            break;
          }
        }
      } else {
        console.log(`✅ Found city center for "${city}":`, selectedCityCenter);
      }
      
      if (!selectedCityCenter) {
        console.warn(`⚠️ No city center coordinates found for "${city}". Available cities:`, Object.keys(CITY_CENTERS).slice(0, 10));
        console.warn(`⚠️ Falling back to city-based filtering.`);
      }
    }

    if (selectedCityCenter && travel_distance) {
      // CROSS-CITY DISTANCE-BASED FILTERING
      const distanceMap = {
        'nearby': 10,    // ≤20km from selected city center (increased from 10)
        'moderate': 40,  // ≤40km from selected city center (increased from 20)
        'far': null      // All distances from selected city center
      };
      
      const maxDistance = distanceMap[travel_distance.toLowerCase()];
      
      if (maxDistance !== null && maxDistance !== undefined) {
        // Calculate distance from selected city center for each destination
        // Include destinations within the distance threshold regardless of their administrative city
        query += ` AND (
          d.distance_from_city_center IS NULL OR
          (6371 * acos(
            cos(radians(?)) * cos(radians(d.latitude)) * 
            cos(radians(d.longitude) - radians(?)) + 
            sin(radians(?)) * sin(radians(d.latitude))
          )) <= ?
        )`;
        
        queryParams.push(
          selectedCityCenter.lat,   // Selected city center latitude
          selectedCityCenter.lng,   // Selected city center longitude  
          selectedCityCenter.lat,   // Selected city center latitude (for sin calculation)
          maxDistance               // Maximum distance
        );
        
        console.log(`🌍 Applied cross-city distance filter: ${travel_distance} (≤${maxDistance}km from ${city} center)`);
        console.log(`📍 Using ${city} center coordinates: ${selectedCityCenter.lat}, ${selectedCityCenter.lng}`);
        
      } else if (travel_distance.toLowerCase() === 'far') {
        // For "far": No distance restriction, but we can still log the city center being used
        console.log(`🌍 Applied cross-city distance filter: ${travel_distance} (no distance limit from ${city} center)`);
        console.log(`📍 Reference point: ${city} center coordinates: ${selectedCityCenter.lat}, ${selectedCityCenter.lng}`);
        // No additional filtering needed - all destinations included
      }
      
    } else if (city && city.trim()) {
      // FALLBACK: Traditional city-based filtering if no city center coordinates or travel_distance
      query += ` AND LOWER(d.city) LIKE ?`;
      queryParams.push(`%${city.trim().toLowerCase()}%`);
      console.log(`🏙️ Applied traditional city-based filter: ${city} (administrative boundaries)`);
      
      if (travel_distance) {
        console.warn(`⚠️ Travel distance preference "${travel_distance}" ignored due to missing city center coordinates`);
      }
    }

    // Filter by travel companion
    if (travel_companion && travel_companion !== 'Any') {
      query += ` AND LOWER(e.travel_companion) = LOWER(?)`;
      queryParams.push(travel_companion.trim());
    }

    // Filter by availability days - ensure experience has availability on trip days
    if (tripDayNames.length > 0) {
      query += ` AND e.experience_id IN (
        SELECT DISTINCT ea.experience_id 
        FROM experience_availability ea 
        WHERE ea.day_of_week IN (${tripDayNames.map(() => '?').join(',')})
      )`;
      queryParams.push(...tripDayNames);
    }

    // Filter by explore time using actual availability time slots
    if (explore_time && explore_time !== 'Both') {
      let timeCondition = '';
      switch (explore_time.toLowerCase()) {
        case 'daytime':
          timeCondition = 'HOUR(ats.start_time) >= 6 AND HOUR(ats.start_time) < 18';
          break;
        case 'nighttime':
          timeCondition = '(HOUR(ats.start_time) >= 18 OR HOUR(ats.start_time) < 6)';
          break;
      }
      
      if (timeCondition) {
        query += ` AND e.experience_id IN (
          SELECT DISTINCT ea.experience_id 
          FROM experience_availability ea
          JOIN availability_time_slots ats ON ea.availability_id = ats.availability_id
          WHERE ${timeCondition}
        )`;
      }
    }

    // Filter by budget
    if (budget && budget !== 'Any') {
      switch (budget.toLowerCase()) {
        case 'free':
          query += ` AND e.price = 0`;
          break;
        case 'budget-friendly':
          query += ` AND e.price <= 500`;
          break;
        case 'mid-range':
          query += ` AND e.price <= 2000`;
          break;
        case 'premium':
          query += ` AND e.price > 2000`;
          break;
      }
    }

    // Group by to handle the aggregated fields
    query += ` GROUP BY e.experience_id, e.creator_id, e.destination_id, e.title, e.description, 
               e.price, e.unit, e.status, e.travel_companion, e.created_at,
               d.name, d.city, d.latitude, d.longitude, d.distance_from_city_center`;

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

    // Updated ordering logic for cross-city approach
    if (selectedCityCenter && travel_distance) {
      if (travel_distance.toLowerCase() === 'nearby') {
        // Nearby: Order by actual distance from selected city center (closest first)
        query += ` ORDER BY 
          (6371 * acos(
            cos(radians(${selectedCityCenter.lat})) * cos(radians(d.latitude)) * 
            cos(radians(d.longitude) - radians(${selectedCityCenter.lng})) + 
            sin(radians(${selectedCityCenter.lat})) * sin(radians(d.latitude))
          )) ASC, 
          e.created_at DESC`;
      } else if (travel_distance.toLowerCase() === 'moderate') {
        // Moderate: Balanced ordering with some preference for closer experiences
        query += ` ORDER BY 
          CASE 
            WHEN d.distance_from_city_center IS NULL THEN 1
            WHEN (6371 * acos(
              cos(radians(${selectedCityCenter.lat})) * cos(radians(d.latitude)) * 
              cos(radians(d.longitude) - radians(${selectedCityCenter.lng})) + 
              sin(radians(${selectedCityCenter.lat})) * sin(radians(d.latitude))
            )) <= 10 THEN 2
            ELSE 3
          END,
          e.created_at DESC`;
      } else {
        // Far: Mix variety with some recency
        query += ` ORDER BY e.created_at DESC`;
      }
    } else {
      // Fallback ordering
      query += ` ORDER BY e.created_at DESC`;
    }

    console.log('Generated Query:', query);
    console.log('Query Parameters:', queryParams);

    // Execute the main query
    const [experiences] = await db.query(query, queryParams);
    console.log('Initial experiences found:', experiences.length);

    // Add images and calculate actual distances from selected city center
    const processedExperiences = [];
    for (const experience of experiences) {
      const [images] = await db.query(`
        SELECT image_url FROM experience_images 
        WHERE experience_id = ? 
        LIMIT 1
      `, [experience.experience_id]);

      // Calculate actual distance from selected city center if available
      let actualDistanceFromSelectedCity = null;
      if (selectedCityCenter && experience.latitude && experience.longitude) {
        actualDistanceFromSelectedCity = calculateDistanceFromCityCenter(
          parseFloat(experience.latitude),
          parseFloat(experience.longitude),
          selectedCityCenter.lat,
          selectedCityCenter.lng
        );
        actualDistanceFromSelectedCity = Math.round(actualDistanceFromSelectedCity * 100) / 100;
      }

      processedExperiences.push({
        ...experience,
        tag_names: experience.tag_names ? experience.tag_names.split(',') : [],
        tag_ids: experience.tag_ids ? experience.tag_ids.split(',').map(Number) : [],
        image_url: images.length > 0 ? images[0].image_url : null,
        // Include both distance values for debugging/info
        distance_from_city_center: experience.distance_from_city_center, // Original (from destination's own city center)
        distance_from_selected_city: actualDistanceFromSelectedCity // New (from selected city center)
      });
    }

    console.log('Final processed experiences:', processedExperiences.length);
    console.log('Travel distance filter applied:', travel_distance);
    
    // Debug: Show distance distribution from selected city center
    if (travel_distance && selectedCityCenter) {
      const distances = processedExperiences
        .map(exp => exp.distance_from_selected_city)
        .filter(d => d !== null)
        .sort((a, b) => a - b);
      
      console.log(`📊 Distance distribution from ${city} center:`, {
        min: distances[0] || 'N/A',
        max: distances[distances.length - 1] || 'N/A',
        count_with_distance: distances.length,
        count_with_null: processedExperiences.length - distances.length,
        sample_distances: distances.slice(0, 5),
        cities_included: [...new Set(processedExperiences.map(exp => exp.city))]
      });
    }
    
    return processedExperiences;

  } catch (error) {
    console.error('Error filtering experiences:', error);
    throw error;
  }
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

module.exports = { generateItinerary, saveItinerary };