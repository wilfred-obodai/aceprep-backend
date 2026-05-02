const express = require('express');
const router  = express.Router();
const { protect, studentOnly } = require('../middleware/auth');
const { createBattle, joinBattle, getBattle } = require('../controllers/battleController');

router.post('/create',       protect, studentOnly, createBattle);
router.post('/join',         protect, studentOnly, joinBattle);
router.get('/:roomCode',     protect,              getBattle);

module.exports = router;