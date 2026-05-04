const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const {
  getChildProgress,
  getChildGrades,
  getChildAttendance,
  linkChild,
  getSchoolTeachers,
} = require('../controllers/parentController');

router.get('/child-progress',   protect, getChildProgress);
router.get('/child-grades',     protect, getChildGrades);
router.get('/child-attendance', protect, getChildAttendance);
router.post('/link-child',      protect, linkChild);
router.get('/school-teachers',  protect, getSchoolTeachers);

module.exports = router;