const express = require('express');
const router  = express.Router();
const { protect, adminOnly, studentOnly } = require('../middleware/auth');
const {
  createExam,
  getSchoolExams,
  getStudentExams,
  getExamQuestions,
  submitExam,
  getExamResults,
} = require('../controllers/examController');

// School admin routes
router.post('/',              protect, adminOnly,  createExam);
router.get('/school',         protect, adminOnly,  getSchoolExams);
router.get('/:id/results',    protect, adminOnly,  getExamResults);

// Student routes
router.get('/student',        protect, studentOnly, getStudentExams);
router.get('/:id/questions',  protect, studentOnly, getExamQuestions);
router.post('/:id/submit',    protect, studentOnly, submitExam);

module.exports = router;