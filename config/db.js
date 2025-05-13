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

// Parse the DATABASE_URL to extract components
const connectionString = process.env.DATABASE_URL;

// Create a connection pool with explicit configuration
const pool = mysql.createPool({
  host: 'aws.connect.psdb.cloud',
  user: 'oc21qtrcw4ickzxi97pe',
  password: process.env.DB_PASSWORD || 'pscale_pw_Khuq1VDNHOc2GgHZIjOLBL5IuAy4aHCvQG6WMvu9cad',
  database: 'db_itinera',
  ssl: {
    rejectUnauthorized: true
  },
  connectionLimit: 10
});

// Export the promise-based pool
module.exports = pool.promise();



