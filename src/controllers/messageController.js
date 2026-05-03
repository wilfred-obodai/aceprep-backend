const pool = require('../config/db');

// ══════════════════════════════════════════════
// SEND MESSAGE
// ══════════════════════════════════════════════
const sendMessage = async (req, res) => {
  try {
    const { recipientId, recipientType, message, subject } = req.body;
    const senderId   = req.userId;
    const senderRole = req.userRole;

    if (!recipientId || !message) {
      return res.status(400).json({ success: false, message: 'Recipient and message are required' });
    }

    // Get sender name
    let senderName = 'Unknown';
    if (senderRole === 'student') {
      const r = await pool.query('SELECT full_name FROM students WHERE id = $1', [senderId]);
      if (r.rows.length > 0) senderName = r.rows[0].full_name;
    } else if (senderRole === 'admin' || senderRole === 'teacher') {
      const r = await pool.query('SELECT full_name FROM teachers WHERE id = $1', [senderId]);
      if (r.rows.length > 0) senderName = r.rows[0].full_name;
    } else if (senderRole === 'parent') {
      const r = await pool.query('SELECT full_name FROM parents WHERE id = $1', [senderId]);
      if (r.rows.length > 0) senderName = r.rows[0].full_name;
    }

    // Get school_id
    let schoolId = null;
    if (senderRole === 'student') {
      const r = await pool.query('SELECT school_id FROM students WHERE id = $1', [senderId]);
      if (r.rows.length > 0) schoolId = r.rows[0].school_id;
    } else if (senderRole === 'admin' || senderRole === 'teacher') {
      const r = await pool.query('SELECT school_id FROM teachers WHERE id = $1', [senderId]);
      if (r.rows.length > 0) schoolId = r.rows[0].school_id;
    } else if (senderRole === 'parent') {
      const r = await pool.query('SELECT school_id FROM parents WHERE id = $1', [senderId]);
      if (r.rows.length > 0) schoolId = r.rows[0].school_id;
    }

    const result = await pool.query(
      `INSERT INTO messages
        (school_id, sender_id, sender_role, receiver_id, receiver_role, subject, content, is_read)
       VALUES ($1, $2, $3, $4, $5, $6, $7, false)
       RETURNING *`,
      [schoolId, senderId, senderRole, recipientId, recipientType || 'teacher', subject || 'Message', message]
    );

    return res.status(201).json({ success: true, message: result.rows[0] });
  } catch (error) {
    console.error('Send message error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// GET INBOX
// ══════════════════════════════════════════════
const getInbox = async (req, res) => {
  try {
    const userId = req.userId;

    const result = await pool.query(
      `SELECT m.*, 
              CASE 
                WHEN m.sender_role = 'student' THEN s.full_name
                WHEN m.sender_role IN ('admin','teacher') THEN t.full_name
                WHEN m.sender_role = 'parent' THEN p.full_name
                ELSE 'Unknown'
              END as sender_name
       FROM messages m
       LEFT JOIN students s ON m.sender_id = s.id AND m.sender_role = 'student'
       LEFT JOIN teachers t ON m.sender_id = t.id AND m.sender_role IN ('admin','teacher')
       LEFT JOIN parents  p ON m.sender_id = p.id AND m.sender_role = 'parent'
       WHERE m.receiver_id = $1
       ORDER BY m.created_at DESC`,
      [userId]
    );

    return res.json({ 
      success: true, 
      messages: result.rows.map(m => ({
        ...m,
        message: m.content,
      }))
    });
  } catch (error) {
    console.error('Get inbox error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// GET SENT
// ══════════════════════════════════════════════
const getSent = async (req, res) => {
  try {
    const userId = req.userId;

    const result = await pool.query(
      `SELECT * FROM messages
       WHERE sender_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    return res.json({ 
      success: true, 
      messages: result.rows.map(m => ({
        ...m,
        message: m.content,
      }))
    });
  } catch (error) {
    console.error('Get sent error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// MARK AS READ
// ══════════════════════════════════════════════
const markAsRead = async (req, res) => {
  try {
    await pool.query(
      'UPDATE messages SET is_read = true WHERE id = $1',
      [req.params.id]
    );
    return res.json({ success: true });
  } catch (error) {
    console.error('Mark as read error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { sendMessage, getInbox, getSent, markAsRead };