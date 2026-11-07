const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const dashboardController = require("../controllers/dashboardController");

router.use(authMiddleware);

router.get("/", dashboardController.getDashboard);
router.get("/trend", dashboardController.getTrend);

module.exports = router;
