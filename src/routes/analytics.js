const express = require('express');
const router  = express.Router();
const { protect, adminOnly, studentOnly } = require('../middleware/auth');
const { getMyAnalytics, getStudentAnalytics, getSchoolReport } = require('../controllers/analyticsController');

router.get('/mine',              protect, studentOnly, getMyAnalytics);
router.get('/student/:studentId', protect, adminOnly,  getStudentAnalytics);
router.get('/school-report',     protect, adminOnly,  getSchoolReport);

module.exports = router;