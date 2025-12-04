const db = require("../config/db.js");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const generateOtp = require("../utils/generateOTP.js");



const requestPasswordReset = async (req, res) => {
const email = req.body.email.trim().toLowerCase();

  // Check user
  const [user] = await db.query(
    "SELECT * FROM users WHERE LOWER(email) = ?",
    [email]
  );

  if (user.length === 0)
    return res.status(404).json({ message: "Email not found" });

  const otp = generateOtp();
  const expires = new Date(Date.now() + 10 * 60 * 1000);

  await db.query(
    `INSERT INTO password_resets (email, otp, expires_at) VALUES (?, ?, ?)`,
    [email, otp, expires]
  );

  // Send email
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL, pass: process.env.EMAIL_PASS },
  });

  await transporter.sendMail({
    from: "Itinera Support",
    to: email,
    subject: "Your Password Reset Code",
    text: `Your OTP code is ${otp}, valid for 10 minutes.`,
  });

  res.json({ message: "OTP sent to email" });
};

const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  const [rows] = await db.query(
    `SELECT * FROM password_resets 
     WHERE email = ? 
     ORDER BY created_at DESC LIMIT 1`,
    [email]
  );

  if (rows.length === 0)
    return res.status(400).json({ message: "Invalid OTP" });

  const record = rows[0];

  if (record.otp !== otp)
    return res.status(400).json({ message: "Incorrect OTP" });

  if (new Date(record.expires_at) < new Date())
    return res.status(400).json({ message: "OTP expired" });

  res.json({ message: "OTP verified" });
};

const resetPassword = async (req, res) => {
  const { email, newPassword } = req.body;

  const hashed = await bcrypt.hash(newPassword, 10);

  await db.query(
    "UPDATE users SET password = ? WHERE email = ?",
    [hashed, email]
  );

  await db.query(
    "DELETE FROM password_resets WHERE email = ?",
    [email]
  );

  res.json({ message: "Password updated successfully" });
};

module.exports = {
  requestPasswordReset,
  verifyOtp,
  resetPassword,
};
