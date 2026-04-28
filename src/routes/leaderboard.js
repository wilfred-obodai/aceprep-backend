const express = require('express');
const router  = express.Router();
const { protect, adminOnly, studentOnly } = require('../middleware/auth');
const { getSchoolLeaderboard, getMyRank } = require('../controllers/leaderboardController');

router.get('/school',   protect, adminOnly,  getSchoolLeaderboard);
router.get('/my-rank',  protect, studentOnly, getMyRank);

module.exports = router;