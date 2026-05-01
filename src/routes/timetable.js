const express = require('express');
const router  = express.Router();
const { protect, adminOnly, studentOnly } = require('../middleware/auth');
const {
  createEntry,
  getSchoolTimetable,
  getStudentTimetable,
  deleteEntry,
} = require('../controllers/timetableController');

router.post('/',        protect, adminOnly,   createEntry);
router.get('/school',   protect, adminOnly,   getSchoolTimetable);
router.get('/student',  protect, studentOnly, getStudentTimetable);
router.delete('/:id',   protect, adminOnly,   deleteEntry);

module.exports = router;