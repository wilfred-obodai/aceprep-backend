const express = require('express');
const router  = express.Router();
const { protect, adminOnly, studentOnly } = require('../middleware/auth');
const { createRoom, getSchoolRooms, joinRoom, deleteRoom } = require('../controllers/videoRoomController');

router.post('/',           protect, adminOnly,   createRoom);
router.get('/school',      protect, adminOnly,   getSchoolRooms);
router.get('/join/:code',  protect,              joinRoom);
router.delete('/:id',      protect, adminOnly,   deleteRoom);

module.exports = router;