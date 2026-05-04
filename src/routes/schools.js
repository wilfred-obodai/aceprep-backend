const express   = require('express');
const router    = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const {
  validateSchoolCode,
  getSchoolProfile,
  getSchoolStudents,
  getSchoolMonitoring,
  getSchoolTeachers,
  searchSchools,
  sendChallenge,
  getChallengeRequests,
  respondToChallenge,
  getReferral,
} = require('../controllers/schoolController');
const {
  getSchoolGrades,
  getStudentGrades,
} = require('../controllers/gradeController');

// Public
router.get('/validate-code/:code', validateSchoolCode);
router.get('/search',              searchSchools);

// Protected — admin only
router.get('/profile',              protect, adminOnly, getSchoolProfile);
router.get('/students',             protect, adminOnly, getSchoolStudents);
router.get('/monitoring',           protect, adminOnly, getSchoolMonitoring);
router.get('/grades',               protect, adminOnly, getSchoolGrades);
router.get('/grades/:studentId',    protect, adminOnly, getStudentGrades);
router.get('/teachers',             protect, adminOnly, getSchoolTeachers);
router.post('/challenge',           protect, adminOnly, sendChallenge);
router.get('/challenge-requests',   protect, adminOnly, getChallengeRequests);
router.put('/challenge/:id',        protect, adminOnly, respondToChallenge);
router.get('/referral',             protect, adminOnly, getReferral);

module.exports = router;