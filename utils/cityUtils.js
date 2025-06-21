// Update your cityUtils.js with correct city names from your database

const CITY_CENTERS = {
  
  // ===== CITIES WITH CORRECT DATABASE NAMES =====
  
  // Use the exact names from your database + common variations
  'Bacolod City': { lat: 10.6770, lng: 122.9540 },
  'Bago City': { lat: 10.5382, lng: 122.8314 },
  'Cadiz City': { lat: 10.9525, lng: 123.2887 },
  'Escalante City': { lat: 10.8342, lng: 123.5018 },
  'Himamaylan City': { lat: 10.1006, lng: 122.8700 },
  'Kabankalan City': { lat: 9.9942, lng: 122.8197 },
  'La Carlota City': { lat: 10.4215, lng: 122.9215 },
  'Sagay City': { lat: 10.8965, lng: 123.4173 },
  'San Carlos City': { lat: 10.4814, lng: 123.4189 },
  'Silay City': { lat: 10.7959, lng: 122.9715 },
  'Sipalay City': { lat: 9.7528, lng: 122.4036 },
  'Talisay City': { lat: 10.7438, lng: 122.9845 },
  'Victorias City': { lat: 10.9043, lng: 123.0735 },
  
  // ===== COMMON VARIATIONS =====
  
  // Without "City" suffix
  'Bacolod': { lat: 10.6770, lng: 122.9540 },
  'Bago': { lat: 10.5382, lng: 122.8314 },
  'Cadiz': { lat: 10.9525, lng: 123.2887 },
  'Escalante': { lat: 10.8342, lng: 123.5018 },
  'Himamaylan': { lat: 10.1006, lng: 122.8700 },
  'Kabankalan': { lat: 9.9942, lng: 122.8197 },
  'La Carlota': { lat: 10.4215, lng: 122.9215 },
  'Sagay': { lat: 10.8965, lng: 123.4173 },
  'San Carlos': { lat: 10.4814, lng: 123.4189 },
  'Silay': { lat: 10.7959, lng: 122.9715 },
  'Sipalay': { lat: 9.7528, lng: 122.4036 },
  'Talisay': { lat: 10.7438, lng: 122.9845 },
  'Victorias': { lat: 10.9043, lng: 123.0735 },
  
  // Lowercase variations
  'bacolod': { lat: 10.6770, lng: 122.9540 },
  'bacolod city': { lat: 10.6770, lng: 122.9540 },
  'bago': { lat: 10.5382, lng: 122.8314 },
  'bago city': { lat: 10.5382, lng: 122.8314 },
  'silay': { lat: 10.7959, lng: 122.9715 },
  'silay city': { lat: 10.7959, lng: 122.9715 },
  'talisay': { lat: 10.7438, lng: 122.9845 },
  'talisay city': { lat: 10.7438, lng: 122.9845 },
  
  // Add municipalities too
  'Binalbagan': { lat: 10.1970, lng: 122.8584 },
  'Calatrava': { lat: 10.5987, lng: 123.4631 },
  'Candoni': { lat: 9.7833, lng: 122.5833 },
  'Cauayan': { lat: 9.9333, lng: 122.7167 },
  'Enrique B. Magalona': { lat: 10.8167, lng: 123.0167 },
  'E.B. Magalona': { lat: 10.8167, lng: 123.0167 },
  'EB Magalona': { lat: 10.8167, lng: 123.0167 },
  'Hinigaran': { lat: 10.2667, lng: 122.8500 },
  'Hinoba-an': { lat: 9.6833, lng: 122.3833 },
  'Ilog': { lat: 10.0167, lng: 122.7833 },
  'Isabela': { lat: 10.2167, lng: 122.9833 },
  'La Castellana': { lat: 10.3167, lng: 123.0167 },
  'Manapla': { lat: 10.9500, lng: 123.1500 },
  'Moises Padilla': { lat: 10.2500, lng: 123.0833 },
  'Murcia': { lat: 10.6000, lng: 123.1833 },
  'Pontevedra': { lat: 10.3833, lng: 122.8333 },
  'Pulupandan': { lat: 10.5167, lng: 122.8000 },
  'Salvador Benedicto': { lat: 10.1667, lng: 123.3500 },
  'San Enrique': { lat: 10.4333, lng: 122.7167 },
  'Toboso': { lat: 10.7333, lng: 123.5333 },
  'Valladolid': { lat: 10.5667, lng: 122.8167 }
};

// Function to calculate distance using Haversine formula (unchanged)
const calculateDistanceFromCityCenter = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
};

// Export both the city centers and the calculation function
module.exports = {
  CITY_CENTERS,
  calculateDistanceFromCityCenter
};