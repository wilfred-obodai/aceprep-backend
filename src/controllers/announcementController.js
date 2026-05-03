const pool = require('../config/db');

// ══════════════════════════════════════════════
// CREATE ANNOUNCEMENT
// POST /api/announcements
// ══════════════════════════════════════════════
const createAnnouncement = async (req, res) => {
  try {
    const { title, content, priority, targetLevel, targetYearGroup } = req.body;
    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Title and content are required' });
    }

    const result = await pool.query(
      `INSERT INTO announcements 
        (school_id, teacher_id, title, content, priority, target_level, target_year_group)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.schoolId, req.userId, title, content, priority || 'normal', targetLevel || null, targetYearGroup || null]
    );

    return res.status(201).json({ success: true, announcement: result.rows[0] });
  } catch (error) {
    console.error('Create announcement error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// GET SCHOOL ANNOUNCEMENTS (Admin)
// GET /api/announcements/school
// ══════════════════════════════════════════════
const getSchoolAnnouncements = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, t.full_name as teacher_name
       FROM announcements a
       LEFT JOIN teachers t ON a.teacher_id = t.id
       WHERE a.school_id = $1
       ORDER BY a.created_at DESC`,
      [req.schoolId]
    );

    return res.json({
      success:       true,
      announcements: result.rows.map(a => ({
        id:          a.id,
        title:       a.title,
        content:     a.content,
        priority:    a.priority,
        teacherName: a.teacher_name,
        createdAt:   a.created_at,
      }))
    });
  } catch (error) {
    console.error('Get announcements error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// GET STUDENT ANNOUNCEMENTS
// GET /api/announcements/student
// ══════════════════════════════════════════════
const getStudentAnnouncements = async (req, res) => {
  try {
    // Get student's school
    const studentResult = await pool.query(
      'SELECT school_id, level, year_group FROM students WHERE id = $1',
      [req.userId]
    );

    if (studentResult.rows.length === 0) {
      return res.json({ success: true, announcements: [] });
    }

    const student = studentResult.rows[0];

    if (!student.school_id) {
      return res.json({ success: true, announcements: [] });
    }

    const result = await pool.query(
      `SELECT a.*, t.full_name as teacher_name
       FROM announcements a
       LEFT JOIN teachers t ON a.teacher_id = t.id
       WHERE a.school_id = $1
         AND (a.target_level IS NULL OR a.target_level = $2)
         AND (a.target_year_group IS NULL OR a.target_year_group = $3)
       ORDER BY a.created_at DESC`,
      [student.school_id, student.level, student.year_group]
    );

    return res.json({
      success:       true,
      announcements: result.rows.map(a => ({
        id:          a.id,
        title:       a.title,
        content:     a.content,
        priority:    a.priority,
        teacherName: a.teacher_name,
        createdAt:   a.created_at,
      }))
    });
  } catch (error) {
    console.error('Get student announcements error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// DELETE ANNOUNCEMENT
// DELETE /api/announcements/:id
// ══════════════════════════════════════════════
const deleteAnnouncement = async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM announcements WHERE id = $1 AND school_id = $2',
      [req.params.id, req.schoolId]
    );
    return res.json({ success: true, message: 'Announcement deleted' });
  } catch (error) {
    console.error('Delete announcement error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  createAnnouncement,
  getSchoolAnnouncements,
  getStudentAnnouncements,
  deleteAnnouncement,
};