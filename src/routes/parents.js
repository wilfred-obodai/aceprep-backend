const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const {
  registerParent,
  loginParent,
  getChildProgress,
} = require('../controllers/parentController');

router.post('/register',       registerParent);
router.post('/login',          loginParent);
router.get('/child-progress',  protect, getChildProgress);

module.exports = router;