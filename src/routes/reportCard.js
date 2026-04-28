const express  = require('express');
const router   = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const { generateReportCard, sendReportCardEmail } = require('../controllers/reportCardController');

router.get('/:studentId',            protect, adminOnly, generateReportCard);
router.post('/:studentId/send-email', protect, adminOnly, sendReportCardEmail);

module.exports = router;