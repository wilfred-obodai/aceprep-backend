const express = require('express');
const router  = express.Router();
const { protect, adminOnly, studentOnly } = require('../middleware/auth');
const {
  createAnnouncement,
  getSchoolAnnouncements,
  getStudentAnnouncements,
  deleteAnnouncement,
} = require('../controllers/announcementController');

router.post('/',         protect, adminOnly,  createAnnouncement);
router.get('/school',    protect, adminOnly,  getSchoolAnnouncements);
router.get('/student',   protect, studentOnly, getStudentAnnouncements);
router.delete('/:id',    protect, adminOnly,  deleteAnnouncement);

module.exports = router;