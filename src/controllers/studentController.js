const pool = require('../config/db');

// ══════════════════════════════════════════════
// START STUDY SESSION (Login tracking)
// POST /api/students/session/start
// ══════════════════════════════════════════════
const startSession = async (req, res) => {
  const { deviceType } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Close any open sessions and start new one atomically
    await client.query(
      `UPDATE study_sessions
       SET logout_at = NOW(),
           duration_minutes = EXTRACT(EPOCH FROM (NOW() - login_at)) / 60
       WHERE student_id = $1 AND logout_at IS NULL`,
      [req.userId]
    );

    // Start new session
    const result = await client.query(
      `INSERT INTO study_sessions (student_id, device_type)
       VALUES ($1, $2)
       RETURNING id, login_at`,
      [req.userId, deviceType || 'unknown']
    );

    await client.query('COMMIT');

    return res.status(201).json({
      success:   true,
      message:   'Study session started!',
      sessionId: result.rows[0].id,
      loginAt:   result.rows[0].login_at,
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Start session error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error — please try again'
    });
  } finally {
    client.release();
  }
};

// ══════════════════════════════════════════════
// END STUDY SESSION (Logout tracking)
// POST /api/students/session/end
// ══════════════════════════════════════════════
const endSession = async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE study_sessions
       SET logout_at        = NOW(),
           duration_minutes = ROUND(EXTRACT(EPOCH FROM (NOW() - login_at)) / 60)
       WHERE student_id = $1 
         AND logout_at IS NULL
       RETURNING id, login_at, logout_at, duration_minutes`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active session found'
      });
    }

    const session = result.rows[0];

    return res.status(200).json({
      success:         true,
      message:         'Study session ended!',
      sessionId:       session.id,
      loginAt:         session.login_at,
      logoutAt:        session.logout_at,
      durationMinutes: session.duration_minutes,
    });

  } catch (error) {
    console.error('End session error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error — please try again'
    });
  }
};

// ══════════════════════════════════════════════
// GET STUDENT PROFILE
// GET /api/students/profile
// ══════════════════════════════════════════════
const getStudentProfile = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.id, s.full_name, s.email, s.level, s.year_group,
              s.class_name, s.shs_track, s.student_type,
              s.gender, s.date_of_birth, s.created_at,
              sc.name as school_name, sc.code as school_code,
              -- Total study time this week
              COALESCE(SUM(ss.duration_minutes) FILTER (
                WHERE ss.login_at >= NOW() - INTERVAL '7 days'
              ), 0) as study_minutes_this_week,
              -- Total sessions
              COUNT(DISTINCT ss.id) as total_sessions,
              -- Study streak (days studied in last 30 days)
              COUNT(DISTINCT DATE(ss.login_at)) FILTER (
                WHERE ss.login_at >= NOW() - INTERVAL '30 days'
              ) as study_days_this_month
       FROM students s
       LEFT JOIN schools sc       ON s.school_id  = sc.id
       LEFT JOIN study_sessions ss ON ss.student_id = s.id
       WHERE s.id = $1
       GROUP BY s.id, sc.name, sc.code`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const s = result.rows[0];

    return res.status(200).json({
      success: true,
      student: {
        id:                  s.id,
        fullName:            s.full_name,
        email:               s.email,
        level:               s.level,
        yearGroup:           s.year_group,
        className:           s.class_name,
        shsTrack:            s.shs_track,
        studentType:         s.student_type,
        gender:              s.gender,
        dateOfBirth:         s.date_of_birth,
        schoolName:          s.school_name,
        schoolCode:          s.school_code,
        studyMinutesThisWeek: parseInt(s.study_minutes_this_week),
        totalSessions:       parseInt(s.total_sessions),
        studyDaysThisMonth:  parseInt(s.study_days_this_month),
        joinedAt:            s.created_at,
      }
    });

  } catch (error) {
    console.error('Get student profile error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error — please try again'
    });
  }
};

// ══════════════════════════════════════════════
// GET STUDENT STUDY SESSIONS HISTORY
// GET /api/students/sessions
// ══════════════════════════════════════════════
const getStudentSessions = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, login_at, logout_at, duration_minutes, device_type
       FROM study_sessions
       WHERE student_id = $1
       ORDER BY login_at DESC
       LIMIT 30`,
      [req.userId]
    );

    return res.status(200).json({
      success:  true,
      total:    result.rows.length,
      sessions: result.rows.map(s => ({
        id:              s.id,
        loginAt:         s.login_at,
        logoutAt:        s.logout_at,
        durationMinutes: s.duration_minutes,
        deviceType:      s.device_type,
        status:          s.logout_at ? 'completed' : 'active',
      }))
    });

  } catch (error) {
    console.error('Get sessions error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error — please try again'
    });
  }
};

module.exports = {
  startSession,
  endSession,
  getStudentProfile,
  getStudentSessions,
};