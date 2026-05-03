const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { protect } = require('../middleware/auth');

// Save message
router.post('/save', protect, async (req, res) => {
  try {
    const { session_id, role, message, pdf_context } = req.body;
    const student_id = req.userId;

    await pool.query(
      `INSERT INTO ai_tutor_chats (student_id, session_id, role, message, pdf_context)
       VALUES ($1, $2, $3, $4, $5)`,
      [student_id, session_id, role, message, pdf_context || null]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get current session chat
router.get('/session/:session_id', protect, async (req, res) => {
  try {
    const student_id = req.userId;
    const result = await pool.query(
      `SELECT * FROM ai_tutor_chats 
       WHERE student_id = $1 AND session_id = $2 
       ORDER BY created_at ASC`,
      [student_id, req.params.session_id]
    );
    res.json({ success: true, messages: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get chat history (all sessions grouped)
router.get('/history', protect, async (req, res) => {
  try {
    const student_id = req.userId;
    const result = await pool.query(
      `SELECT session_id,
              MIN(created_at) AS started_at,
              COUNT(*) AS message_count,
              (SELECT message FROM ai_tutor_chats 
               WHERE student_id = $1 AND session_id = ac.session_id 
               AND role = 'user' 
               ORDER BY created_at ASC LIMIT 1) AS first_message
       FROM ai_tutor_chats ac
       WHERE student_id = $1
       GROUP BY session_id
       ORDER BY started_at DESC
       LIMIT 20`,
      [student_id]
    );
    res.json({ success: true, history: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get full session messages
router.get('/history/:session_id', protect, async (req, res) => {
  try {
    const student_id = req.userId;
    const result = await pool.query(
      `SELECT * FROM ai_tutor_chats 
       WHERE student_id = $1 AND session_id = $2 
       ORDER BY created_at ASC`,
      [student_id, req.params.session_id]
    );
    res.json({ success: true, messages: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete a session
router.delete('/history/:session_id', protect, async (req, res) => {
  try {
    const student_id = req.userId;
    await pool.query(
      'DELETE FROM ai_tutor_chats WHERE student_id = $1 AND session_id = $2',
      [student_id, req.params.session_id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;