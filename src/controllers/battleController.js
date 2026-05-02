const pool   = require('../config/db');
const crypto = require('crypto');

// ══════════════════════════════════════════════
// CREATE BATTLE ROOM
// POST /api/battle/create
// ══════════════════════════════════════════════
const createBattle = async (req, res) => {
  const { subject, level } = req.body;

  try {
    const roomCode = crypto.randomBytes(3).toString('hex').toUpperCase();

    const result = await pool.query(
      `INSERT INTO battle_rooms (room_code, host_id, subject, status)
       VALUES ($1, $2, $3, 'waiting')
       RETURNING *`,
      [roomCode, req.userId, subject || 'Mixed']
    );

    // Add host as participant
    await pool.query(
      `INSERT INTO battle_participants (room_id, student_id)
       VALUES ($1, $2)`,
      [result.rows[0].id, req.userId]
    );

    return res.status(201).json({
      success:  true,
      message:  'Battle room created!',
      roomCode: result.rows[0].room_code,
      roomId:   result.rows[0].id,
    });

  } catch (error) {
    console.error('Create battle error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// JOIN BATTLE ROOM
// POST /api/battle/join
// ══════════════════════════════════════════════
const joinBattle = async (req, res) => {
  const { roomCode } = req.body;

  try {
    const roomResult = await pool.query(
      `SELECT * FROM battle_rooms WHERE room_code = $1 AND status = 'waiting'`,
      [roomCode.toUpperCase()]
    );

    if (roomResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Room not found or battle already started'
      });
    }

    const room = roomResult.rows[0];

    // Check if already joined
    const existing = await pool.query(
      'SELECT id FROM battle_participants WHERE room_id = $1 AND student_id = $2',
      [room.id, req.userId]
    );

    if (existing.rows.length === 0) {
      await pool.query(
        'INSERT INTO battle_participants (room_id, student_id) VALUES ($1, $2)',
        [room.id, req.userId]
      );
    }

    // Get participants
    const participants = await pool.query(
      `SELECT bp.*, s.full_name
       FROM battle_participants bp
       JOIN students s ON s.id = bp.student_id
       WHERE bp.room_id = $1`,
      [room.id]
    );

    return res.status(200).json({
      success:      true,
      roomId:       room.id,
      roomCode:     room.room_code,
      subject:      room.subject,
      participants: participants.rows.map(p => ({
        studentId: p.student_id,
        fullName:  p.full_name,
        score:     p.score,
      }))
    });

  } catch (error) {
    console.error('Join battle error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// GET BATTLE ROOM INFO
// GET /api/battle/:roomCode
// ══════════════════════════════════════════════
const getBattle = async (req, res) => {
  try {
    const roomResult = await pool.query(
      'SELECT * FROM battle_rooms WHERE room_code = $1',
      [req.params.roomCode.toUpperCase()]
    );

    if (roomResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    const room = roomResult.rows[0];
    const participants = await pool.query(
      `SELECT bp.*, s.full_name
       FROM battle_participants bp
       JOIN students s ON s.id = bp.student_id
       WHERE bp.room_id = $1
       ORDER BY bp.score DESC`,
      [room.id]
    );

    return res.status(200).json({
      success:      true,
      room: {
        id:       room.id,
        roomCode: room.room_code,
        subject:  room.subject,
        status:   room.status,
      },
      participants: participants.rows.map(p => ({
        studentId: p.student_id,
        fullName:  p.full_name,
        score:     p.score,
        rank:      p.rank,
      }))
    });

  } catch (error) {
    console.error('Get battle error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { createBattle, joinBattle, getBattle };