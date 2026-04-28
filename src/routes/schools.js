const express   = require('express');
const router    = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const {
  validateSchoolCode,
  getSchoolProfile,
  getSchoolStudents,
  getSchoolMonitoring,
  getSchoolTeachers,
} = require('../controllers/schoolController');
const {
  getSchoolGrades,
  getStudentGrades,
} = require('../controllers/gradeController');

// ── Public ──────────────────────────────────
router.get('/validate-code/:code', validateSchoolCode);

// ── Protected — school admin only ───────────
router.get('/profile',           protect, adminOnly, getSchoolProfile);
router.get('/students',          protect, adminOnly, getSchoolStudents);
router.get('/monitoring',        protect, adminOnly, getSchoolMonitoring);
router.get('/grades',            protect, adminOnly, getSchoolGrades);
router.get('/grades/:studentId', protect, adminOnly, getStudentGrades);
router.get('/teachers',          protect, adminOnly, getSchoolTeachers);

module.exports = router;