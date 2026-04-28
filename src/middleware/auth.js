const jwt  = require('jsonwebtoken');
const pool = require('../config/db');

// ── Protect route — any logged in user ─────────
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized — please login'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId   = decoded.id;
    req.userRole = decoded.role;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token is invalid or expired — please login again'
    });
  }
};

// ── Admin/Teacher only ──────────────────────────
const adminOnly = async (req, res, next) => {
  if (!req.userId || !req.userRole) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized — please login'
    });
  }

  if (req.userRole !== 'admin' && req.userRole !== 'teacher') {
    return res.status(403).json({
      success: false,
      message: 'Access denied — school staff only'
    });
  }

  try {
    // Get school ID from teacher record
    const result = await pool.query(
      'SELECT school_id, role FROM teachers WHERE id = $1',
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Teacher account not found'
      });
    }

    req.schoolId    = result.rows[0].school_id;
    req.teacherRole = result.rows[0].role;
    next();

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ── Student only ────────────────────────────────
const studentOnly = async (req, res, next) => {
  if (!req.userId || !req.userRole) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized — please login'
    });
  }

  if (req.userRole !== 'student') {
    return res.status(403).json({
      success: false,
      message: 'Access denied — students only'
    });
  }

  try {
    const result = await pool.query(
      'SELECT school_id, student_type FROM students WHERE id = $1',
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Student account not found'
      });
    }

    req.schoolId    = result.rows[0].school_id;
    req.studentType = result.rows[0].student_type;
    next();

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = { protect, adminOnly, studentOnly };