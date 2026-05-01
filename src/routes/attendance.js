const express = require('express');
const router  = express.Router();
const { protect, adminOnly, studentOnly } = require('../middleware/auth');
const { markAttendance, getSchoolAttendance, getMyAttendance } = require('../controllers/attendanceController');

router.post('/',        protect, adminOnly,   markAttendance);
router.get('/school',   protect, adminOnly,   getSchoolAttendance);
router.get('/mine',     protect, studentOnly, getMyAttendance);

module.exports = router;