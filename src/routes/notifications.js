const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const pool = require('../config/db');

router.get('/', protect, async (req, res) => {
  try {
    // Return empty for now — will be populated by app events
    return res.json({ success: true, notifications: [] });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/read-all', protect, async (req, res) => {
  return res.json({ success: true });
});

router.put('/:id/read', protect, async (req, res) => {
  return res.json({ success: true });
});

module.exports = router;