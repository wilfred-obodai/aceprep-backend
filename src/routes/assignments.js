const express = require('express');
const router  = express.Router();
const { protect, adminOnly, studentOnly } = require('../middleware/auth');
const {
  createAssignment,
  getSchoolAssignments,
  getStudentAssignments,
  submitAssignment,
  getSubmissions,
  gradeSubmission,
} = require('../controllers/assignmentController');

// School admin/teacher routes
router.post('/',                         protect, adminOnly,  createAssignment);
router.get('/school',                    protect, adminOnly,  getSchoolAssignments);
router.get('/:id/submissions',           protect, adminOnly,  getSubmissions);
router.post('/submissions/:id/grade',    protect, adminOnly,  gradeSubmission);

// Student routes
router.get('/student',                   protect, studentOnly, getStudentAssignments);
router.post('/:id/submit',               protect, studentOnly, submitAssignment);

module.exports = router;