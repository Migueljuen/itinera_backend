// const mysql = require('mysql2');
// const pool = mysql.createPool({
// host: 'localhost',
// user: 'root',
// password: '1234',
// database: 'db_itinera',
// waitForConnections: true,
// connectionLimit: 10,
// queueLimit: 0
// }); 
// module.exports = pool.promise();

const mysql = require('mysql2');
require('dotenv').config();

// Create a connection pool with proper configuration for PlanetScale
const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: true
  },
  connectionLimit: 10
});

// Export the promise-based pool
module.exports = pool.promise();




