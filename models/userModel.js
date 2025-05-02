const db = require('../config/db.js');

const findByEmail = async (email) => {
  const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
  return rows[0]; // return the first match (or undefined)
};

module.exports = { findByEmail };