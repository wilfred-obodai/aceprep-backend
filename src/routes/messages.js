const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const { sendMessage, getInbox, markAsRead, getSent } = require('../controllers/messageController');

router.post('/',          protect, sendMessage);
router.post('/send',      protect, sendMessage);
router.get('/inbox',      protect, getInbox);
router.get('/sent',       protect, getSent);
router.put('/:id/read',   protect, markAsRead);

module.exports = router;