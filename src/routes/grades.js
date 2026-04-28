const express = require('express');
const router  = express.Router();
const { protect, studentOnly } = require('../middleware/auth');
const {
  submitGrade,
  getMyGrades,
} = require('../controllers/gradeController');

// Student routes
router.post('/submit', protect, studentOnly, submitGrade);
router.get('/mine',    protect, studentOnly, getMyGrades);

module.exports = router;