const express = require("express");
const router = express.Router();

const {
  requestPasswordReset,
  verifyOtp,
  resetPassword,
} = require("../controllers/passwordResetController.js");

router.post("/request", requestPasswordReset);
router.post("/verify", verifyOtp);
router.post("/reset", resetPassword);

module.exports = router;
