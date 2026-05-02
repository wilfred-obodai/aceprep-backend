const express = require('express');
const router  = express.Router();
const { protect, adminOnly, studentOnly } = require('../middleware/auth');
const { getMyAnalytics, getStudentAnalytics } = require('../controllers/analyticsController');

router.get('/mine',              protect, studentOnly, getMyAnalytics);
router.get('/student/:studentId', protect, adminOnly,  getStudentAnalytics);

module.exports = router;