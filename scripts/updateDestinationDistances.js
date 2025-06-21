// scripts/updateDestinationDistances.js

// STEP 1: Import what we need
const db = require('../config/db.js'); // Your database connection
const { CITY_CENTERS, calculateDistanceFromCityCenter } = require('../utils/cityUtils.js');

async function updateAllDestinationDistances() {
  try {
    console.log('🚀 Starting to update destination distances...');

    // STEP 2: Find all destinations that need distance calculation
    // This query gets destinations where distance_from_city_center is NULL
    const [destinationsToUpdate] = await db.query(`
      SELECT destination_id, name, city, latitude, longitude 
      FROM destination 
      WHERE distance_from_city_center IS NULL 
      AND latitude IS NOT NULL 
      AND longitude IS NOT NULL
    `);

    console.log(`📍 Found ${destinationsToUpdate.length} destinations to update`);

    let updated = 0;
    let skipped = 0;

    // STEP 3: Loop through each destination that needs updating
    for (const destination of destinationsToUpdate) {
      const { destination_id, name, city, latitude, longitude } = destination;
      
      console.log(`🔄 Processing: ${name} in ${city}...`);
      
      // STEP 4: Look up the city center coordinates
      const cityCenter = CITY_CENTERS[city];
      
      if (cityCenter) {
        // STEP 5: Calculate the distance using our function
        const distance = calculateDistanceFromCityCenter(
          parseFloat(latitude),      // Destination latitude
          parseFloat(longitude),     // Destination longitude
          cityCenter.lat,            // City center latitude
          cityCenter.lng             // City center longitude
        );
        
        // STEP 6: Round to 2 decimal places for cleaner data
        const roundedDistance = Math.round(distance * 100) / 100;
        
        // STEP 7: Update the database with the calculated distance
        await db.query(
          'UPDATE destination SET distance_from_city_center = ? WHERE destination_id = ?',
          [roundedDistance, destination_id]
        );
        
        console.log(`✅ Updated: ${name} (${city}) - ${roundedDistance}km from center`);
        updated++;
        
      } else {
        // STEP 8: Skip if we don't have city center coordinates
        console.log(`⚠️ Skipped: ${name} (${city}) - No city center coordinates found`);
        skipped++;
      }
    }

    // STEP 9: Show summary of what happened
    console.log('\n📊 Summary:');
    console.log(`✅ Updated: ${updated} destinations`);
    console.log(`⚠️ Skipped: ${skipped} destinations`);
    console.log('🎉 Distance update complete!');

    // STEP 10: Show results by city
    const [results] = await db.query(`
      SELECT city, COUNT(*) as total, 
             COUNT(distance_from_city_center) as with_distance
      FROM destination 
      GROUP BY city 
      ORDER BY city
    `);

    console.log('\n📈 Results by city:');
    results.forEach(row => {
      console.log(`${row.city}: ${row.with_distance}/${row.total} destinations have distances`);
    });

  } catch (error) {
    console.error('❌ Error updating distances:', error);
  } finally {
    // STEP 11: Exit the script when done
    process.exit();
  }
}

// STEP 12: Actually run the function
updateAllDestinationDistances();