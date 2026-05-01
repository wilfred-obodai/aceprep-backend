const pool = require('../config/db');

// ══════════════════════════════════════════════
// CREATE ANNOUNCEMENT
// POST /api/announcements
// ══════════════════════════════════════════════
const createAnnouncement = async (req, res) => {
  const { title, content, level, yearGroup, className, priority } = req.body;

  if (!title || !content) {
    return res.status(400).json({
      success: false,
      message: 'Title and content are required'
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO announcements
        (school_id, teacher_id, title, content, level,
         year_group, class_name, priority)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        req.schoolId, req.userId, title, content,
        level || null, yearGroup || null,
        className || null, priority || 'normal'
      ]
    );

    return res.status(201).json({
      success:      true,
      message:      'Announcement posted successfully!',
      announcement: result.rows[0]
    });
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
       LEFT JOIN teachers t ON t.id = a.teacher_id
       WHERE a.school_id = $1
       ORDER BY a.created_at DESC`,
      [req.schoolId]
    );

    return res.status(200).json({
      success:       true,
      total:         result.rows.length,
      announcements: result.rows.map(a => ({
        id:          a.id,
        title:       a.title,
        content:     a.content,
        level:       a.level,
        yearGroup:   a.year_group,
        className:   a.class_name,
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
    const studentResult = await pool.query(
      'SELECT school_id, level, year_group, class_name FROM students WHERE id = $1',
      [req.userId]
    );

    const student = studentResult.rows[0];
    if (!student?.school_id) {
      return res.status(200).json({ success: true, total: 0, announcements: [] });
    }

    const result = await pool.query(
      `SELECT a.*, t.full_name as teacher_name
       FROM announcements a
       LEFT JOIN teachers t ON t.id = a.teacher_id
       WHERE a.school_id = $1
         AND (a.level IS NULL OR a.level = $2)
         AND (a.year_group IS NULL OR a.year_group = $3)
       ORDER BY a.priority DESC, a.created_at DESC`,
      [student.school_id, student.level, student.year_group]
    );

    return res.status(200).json({
      success:       true,
      total:         result.rows.length,
      announcements: result.rows.map(a => ({
        id:          a.id,
        title:       a.title,
        content:     a.content,
        level:       a.level,
        yearGroup:   a.year_group,
        className:   a.class_name,
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
  const { id } = req.params;
  try {
    await pool.query(
      'DELETE FROM announcements WHERE id = $1 AND school_id = $2',
      [id, req.schoolId]
    );
    return res.status(200).json({ success: true, message: 'Announcement deleted' });
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