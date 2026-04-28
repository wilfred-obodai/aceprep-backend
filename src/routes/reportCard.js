const express  = require('express');
const router   = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const { generateReportCard } = require('../controllers/reportCardController');

router.get('/:studentId', protect, adminOnly, generateReportCard);

module.exports = router;