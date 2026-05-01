const pool = require('../config/db');

// ══════════════════════════════════════════════
// CREATE TIMETABLE ENTRY
// POST /api/timetable
// ══════════════════════════════════════════════
const createEntry = async (req, res) => {
  const {
    subject, dayOfWeek, startTime, endTime,
    level, yearGroup, className, room
  } = req.body;

  if (!subject || !dayOfWeek || !startTime || !endTime) {
    return res.status(400).json({
      success: false,
      message: 'Subject, day, start time and end time are required'
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO timetable
        (school_id, teacher_id, subject, day_of_week,
         start_time, end_time, level, year_group, class_name, room)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        req.schoolId, req.userId, subject, dayOfWeek,
        startTime, endTime, level || null,
        yearGroup || null, className || null, room || null
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Timetable entry added!',
      entry:   result.rows[0]
    });
  } catch (error) {
    console.error('Create timetable error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// GET SCHOOL TIMETABLE
// GET /api/timetable/school
// ══════════════════════════════════════════════
const getSchoolTimetable = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.*, te.full_name as teacher_name
       FROM timetable t
       LEFT JOIN teachers te ON te.id = t.teacher_id
       WHERE t.school_id = $1
       ORDER BY
         CASE day_of_week
           WHEN 'Monday'    THEN 1
           WHEN 'Tuesday'   THEN 2
           WHEN 'Wednesday' THEN 3
           WHEN 'Thursday'  THEN 4
           WHEN 'Friday'    THEN 5
           ELSE 6
         END,
         t.start_time`,
      [req.schoolId]
    );

    return res.status(200).json({
      success:   true,
      total:     result.rows.length,
      timetable: result.rows.map(t => ({
        id:          t.id,
        subject:     t.subject,
        dayOfWeek:   t.day_of_week,
        startTime:   t.start_time,
        endTime:     t.end_time,
        level:       t.level,
        yearGroup:   t.year_group,
        className:   t.class_name,
        room:        t.room,
        teacherName: t.teacher_name,
      }))
    });
  } catch (error) {
    console.error('Get timetable error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// GET STUDENT TIMETABLE
// GET /api/timetable/student
// ══════════════════════════════════════════════
const getStudentTimetable = async (req, res) => {
  try {
    const studentResult = await pool.query(
      'SELECT school_id, level, year_group, class_name FROM students WHERE id = $1',
      [req.userId]
    );

    const student = studentResult.rows[0];
    if (!student?.school_id) {
      return res.status(200).json({ success: true, total: 0, timetable: [] });
    }

    const result = await pool.query(
      `SELECT t.*, te.full_name as teacher_name
       FROM timetable t
       LEFT JOIN teachers te ON te.id = t.teacher_id
       WHERE t.school_id = $1
         AND (t.level IS NULL OR t.level = $2)
         AND (t.year_group IS NULL OR t.year_group = $3)
       ORDER BY
         CASE day_of_week
           WHEN 'Monday'    THEN 1
           WHEN 'Tuesday'   THEN 2
           WHEN 'Wednesday' THEN 3
           WHEN 'Thursday'  THEN 4
           WHEN 'Friday'    THEN 5
           ELSE 6
         END,
         t.start_time`,
      [student.school_id, student.level, student.year_group]
    );

    return res.status(200).json({
      success:   true,
      total:     result.rows.length,
      timetable: result.rows.map(t => ({
        id:          t.id,
        subject:     t.subject,
        dayOfWeek:   t.day_of_week,
        startTime:   t.start_time,
        endTime:     t.end_time,
        level:       t.level,
        yearGroup:   t.year_group,
        className:   t.class_name,
        room:        t.room,
        teacherName: t.teacher_name,
      }))
    });
  } catch (error) {
    console.error('Get student timetable error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// DELETE TIMETABLE ENTRY
// DELETE /api/timetable/:id
// ══════════════════════════════════════════════
const deleteEntry = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      'DELETE FROM timetable WHERE id = $1 AND school_id = $2',
      [id, req.schoolId]
    );
    return res.status(200).json({ success: true, message: 'Entry deleted' });
  } catch (error) {
    console.error('Delete timetable error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { createEntry, getSchoolTimetable, getStudentTimetable, deleteEntry };