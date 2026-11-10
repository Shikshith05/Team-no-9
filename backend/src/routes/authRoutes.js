const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const { authLimiter, loginLimiter } = require("../middleware/rateLimiter");

router.post("/register", authLimiter, authController.register);
router.post("/login", loginLimiter, authController.login);
router.post("/logout", authMiddleware, authController.logout);
router.post("/forgot-password", authLimiter, authController.forgotPassword);
router.post("/reset-password", authLimiter, authController.resetPassword);

module.exports = router;

