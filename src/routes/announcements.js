const express = require('express');
const router  = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const {
  createAnnouncement,
  getSchoolAnnouncements,
  getStudentAnnouncements,
  deleteAnnouncement,
} = require('../controllers/announcementController');

router.post('/',      protect, adminOnly, createAnnouncement);
router.get('/school', protect, adminOnly, getSchoolAnnouncements);
router.get('/student',protect,            getStudentAnnouncements);
router.delete('/:id', protect, adminOnly, deleteAnnouncement);

module.exports = router;