const mysql = require('mysql2');
const pool = mysql.createPool({
host: 'localhost',
user: 'root',
password: '1234',
database: 'db_itinera',
waitForConnections: true,
connectionLimit: 10,
queueLimit: 0
}); 
module.exports = pool.promise();