const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const {
  getPastQuestions,
  getSubjects,
  getQuestion,
} = require('../controllers/questionController');

// All routes require login
router.get('/',          protect, getPastQuestions);
router.get('/subjects',  protect, getSubjects);
router.get('/:id',       protect, getQuestion);

module.exports = router;