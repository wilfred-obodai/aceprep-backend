const pool = require('../config/db');

// ══════════════════════════════════════════════
// SEND MESSAGE
// POST /api/messages
// ══════════════════════════════════════════════
const sendMessage = async (req, res) => {
  const { receiverId, receiverRole, subject, content } = req.body;

  if (!receiverId || !content) {
    return res.status(400).json({ success: false, message: 'Receiver and content required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO messages
        (school_id, sender_id, sender_role, receiver_id, receiver_role, subject, content)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        req.schoolId, req.userId, req.userRole,
        receiverId, receiverRole, subject || 'No Subject', content
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Message sent!',
      data:    result.rows[0]
    });

  } catch (error) {
    console.error('Send message error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// GET MY MESSAGES
// GET /api/messages/inbox
// ══════════════════════════════════════════════
const getInbox = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.*,
        CASE WHEN m.sender_role = 'student'
          THEN (SELECT full_name FROM students WHERE id = m.sender_id)
          ELSE (SELECT full_name FROM teachers WHERE id = m.sender_id)
        END as sender_name
       FROM messages m
       WHERE m.receiver_id = $1 AND m.receiver_role = $2
       ORDER BY m.created_at DESC`,
      [req.userId, req.userRole]
    );

    return res.status(200).json({
      success:  true,
      total:    result.rows.length,
      unread:   result.rows.filter(m => !m.is_read).length,
      messages: result.rows.map(m => ({
        id:           m.id,
        senderName:   m.sender_name,
        senderRole:   m.sender_role,
        subject:      m.subject,
        content:      m.content,
        isRead:       m.is_read,
        createdAt:    m.created_at,
      }))
    });

  } catch (error) {
    console.error('Get inbox error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// MARK MESSAGE AS READ
// PUT /api/messages/:id/read
// ══════════════════════════════════════════════
const markAsRead = async (req, res) => {
  try {
    await pool.query(
      'UPDATE messages SET is_read = true WHERE id = $1 AND receiver_id = $2',
      [req.params.id, req.userId]
    );
    return res.status(200).json({ success: true, message: 'Marked as read' });
  } catch (error) {
    console.error('Mark read error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// GET SENT MESSAGES
// GET /api/messages/sent
// ══════════════════════════════════════════════
const getSent = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.*,
        CASE WHEN m.receiver_role = 'student'
          THEN (SELECT full_name FROM students WHERE id = m.receiver_id)
          ELSE (SELECT full_name FROM teachers WHERE id = m.receiver_id)
        END as receiver_name
       FROM messages m
       WHERE m.sender_id = $1 AND m.sender_role = $2
       ORDER BY m.created_at DESC`,
      [req.userId, req.userRole]
    );

    return res.status(200).json({
      success:  true,
      total:    result.rows.length,
      messages: result.rows.map(m => ({
        id:           m.id,
        receiverName: m.receiver_name,
        receiverRole: m.receiver_role,
        subject:      m.subject,
        content:      m.content,
        isRead:       m.is_read,
        createdAt:    m.created_at,
      }))
    });

  } catch (error) {
    console.error('Get sent error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { sendMessage, getInbox, markAsRead, getSent };