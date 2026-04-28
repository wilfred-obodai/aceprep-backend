const express = require('express');
const router  = express.Router();
const { protect, studentOnly } = require('../middleware/auth');
const {
  startSession,
  endSession,
  getStudentProfile,
  getStudentSessions,
} = require('../controllers/studentController');

// All routes require student login
router.post('/session/start', protect, studentOnly, startSession);
router.post('/session/end',   protect, studentOnly, endSession);
router.get('/profile',        protect, studentOnly, getStudentProfile);
router.get('/sessions',       protect, studentOnly, getStudentSessions);

module.exports = router;