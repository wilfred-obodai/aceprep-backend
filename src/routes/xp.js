const express = require('express');
const router  = express.Router();
const { protect, adminOnly, studentOnly } = require('../middleware/auth');
const { getMyXP, getXPLeaderboard, awardSessionXP } = require('../controllers/xpController');

router.get('/mine',               protect, studentOnly, getMyXP);
router.get('/school-leaderboard', protect, adminOnly,   getXPLeaderboard);
router.post('/session',           protect, studentOnly, awardSessionXP);

module.exports = router;