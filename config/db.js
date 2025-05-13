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

// Create a connection pool using DATABASE_URL
const pool = mysql.createPool(process.env.DATABASE_URL);

// Export the promise-based pool
module.exports = pool.promise();




