const express    = require('express');
const router     = express.Router();
const { protect, studentOnly } = require('../middleware/auth');
const { getMyStreak } = require('../controllers/streakController');

router.get('/mine', protect, studentOnly, getMyStreak);

module.exports = router;