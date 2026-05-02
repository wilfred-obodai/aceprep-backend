const pool   = require('../config/db');
const crypto = require('crypto');

// ══════════════════════════════════════════════
// CREATE VIDEO ROOM (Teacher)
// POST /api/video-rooms
// ══════════════════════════════════════════════
const createRoom = async (req, res) => {
  const { roomName, subject, level, yearGroup } = req.body;

  if (!roomName) {
    return res.status(400).json({ success: false, message: 'Room name is required' });
  }

  try {
    const roomCode = crypto.randomBytes(3).toString('hex').toUpperCase();

    // Create room in Daily.co if API key exists
    let dailyUrl = null;
    if (process.env.DAILY_API_KEY) {
      try {
        const dailyRes = await fetch('https://api.daily.co/v1/rooms', {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${process.env.DAILY_API_KEY}`
          },
          body: JSON.stringify({
            name:       `aceprep-${roomCode.toLowerCase()}`,
            properties: {
              max_participants: 50,
              enable_chat:      true,
              enable_screenshare: true,
              exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
            }
          })
        });
        const dailyData = await dailyRes.json();
        dailyUrl = dailyData.url || null;
      } catch (e) {
        console.error('Daily.co error:', e.message);
      }
    }

    const result = await pool.query(
      `INSERT INTO video_rooms
        (school_id, teacher_id, room_name, room_code, daily_url, subject, level, year_group)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        req.schoolId, req.userId, roomName, roomCode,
        dailyUrl, subject || null, level || null, yearGroup || null
      ]
    );

    return res.status(201).json({
      success:  true,
      message:  'Video room created!',
      room: {
        id:       result.rows[0].id,
        roomName: result.rows[0].room_name,
        roomCode: result.rows[0].room_code,
        dailyUrl: result.rows[0].daily_url,
        subject:  result.rows[0].subject,
      }
    });

  } catch (error) {
    console.error('Create room error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// GET SCHOOL VIDEO ROOMS
// GET /api/video-rooms/school
// ══════════════════════════════════════════════
const getSchoolRooms = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT v.*, t.full_name as teacher_name
       FROM video_rooms v
       LEFT JOIN teachers t ON t.id = v.teacher_id
       WHERE v.school_id = $1 AND v.status = 'active'
       ORDER BY v.created_at DESC`,
      [req.schoolId]
    );

    return res.status(200).json({
      success: true,
      rooms:   result.rows.map(r => ({
        id:          r.id,
        roomName:    r.room_name,
        roomCode:    r.room_code,
        dailyUrl:    r.daily_url,
        subject:     r.subject,
        level:       r.level,
        yearGroup:   r.year_group,
        teacherName: r.teacher_name,
        createdAt:   r.created_at,
      }))
    });

  } catch (error) {
    console.error('Get rooms error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// JOIN ROOM BY CODE (Student)
// GET /api/video-rooms/join/:code
// ══════════════════════════════════════════════
const joinRoom = async (req, res) => {
  const { code } = req.params;

  try {
    const result = await pool.query(
      `SELECT v.*, t.full_name as teacher_name
       FROM video_rooms v
       LEFT JOIN teachers t ON t.id = v.teacher_id
       WHERE v.room_code = $1 AND v.status = 'active'`,
      [code.toUpperCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Room not found. Check the code and try again.'
      });
    }

    const room = result.rows[0];

    return res.status(200).json({
      success: true,
      room: {
        id:          room.id,
        roomName:    room.room_name,
        roomCode:    room.room_code,
        dailyUrl:    room.daily_url,
        subject:     room.subject,
        teacherName: room.teacher_name,
      }
    });

  } catch (error) {
    console.error('Join room error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// DELETE VIDEO ROOM
// DELETE /api/video-rooms/:id
// ══════════════════════════════════════════════
const deleteRoom = async (req, res) => {
  try {
    await pool.query(
      `UPDATE video_rooms SET status = 'ended'
       WHERE id = $1 AND school_id = $2`,
      [req.params.id, req.schoolId]
    );
    return res.status(200).json({ success: true, message: 'Room ended' });
  } catch (error) {
    console.error('Delete room error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { createRoom, getSchoolRooms, joinRoom, deleteRoom };