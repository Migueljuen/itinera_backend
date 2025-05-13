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

// Create a connection pool using the connection string
const pool = mysql.createPool(process.env.DATABASE_URL);

module.exports = pool.promise();

