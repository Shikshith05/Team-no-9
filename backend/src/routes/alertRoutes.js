const express = require("express");
const router = express.Router();
const alertController = require("../controllers/alertController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

router.get("/", alertController.listAlerts);
router.post("/", alertController.createAlert);

module.exports = router;
