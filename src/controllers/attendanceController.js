const pool = require('../config/db');

// ══════════════════════════════════════════════
// MARK ATTENDANCE
// POST /api/attendance
// ══════════════════════════════════════════════
const markAttendance = async (req, res) => {
  const { records, date, subject } = req.body;
  // records = [{ studentId, status, notes }]

  if (!records || !Array.isArray(records)) {
    return res.status(400).json({ success: false, message: 'Records array required' });
  }

  try {
    const attendanceDate = date || new Date().toISOString().split('T')[0];

    for (const record of records) {
      await pool.query(
        `INSERT INTO attendance (school_id, student_id, teacher_id, date, status, subject, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (student_id, date, subject) DO UPDATE
         SET status = $5, notes = $7`,
        [
          req.schoolId, record.studentId, req.userId,
          attendanceDate, record.status || 'present',
          subject || null, record.notes || null
        ]
      );
    }

    return res.status(200).json({
      success: true,
      message: `Attendance marked for ${records.length} students`
    });

  } catch (error) {
    console.error('Mark attendance error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// GET SCHOOL ATTENDANCE
// GET /api/attendance/school
// ══════════════════════════════════════════════
const getSchoolAttendance = async (req, res) => {
  const { date, subject, yearGroup, className } = req.query;

  try {
    let query = `
      SELECT a.*, s.full_name, s.level, s.year_group, s.class_name
      FROM attendance a
      JOIN students s ON s.id = a.student_id
      WHERE a.school_id = $1
    `;
    const params = [req.schoolId];

    if (date) { params.push(date); query += ` AND a.date = $${params.length}`; }
    if (subject) { params.push(subject); query += ` AND a.subject = $${params.length}`; }
    if (yearGroup) { params.push(yearGroup); query += ` AND s.year_group = $${params.length}`; }
    if (className) { params.push(className); query += ` AND s.class_name = $${params.length}`; }

    query += ' ORDER BY a.date DESC, s.full_name';

    const result = await pool.query(query, params);

    // Summary
    const total   = result.rows.length;
    const present = result.rows.filter(r => r.status === 'present').length;
    const absent  = result.rows.filter(r => r.status === 'absent').length;
    const late    = result.rows.filter(r => r.status === 'late').length;

    return res.status(200).json({
      success: true,
      summary: { total, present, absent, late },
      records: result.rows.map(r => ({
        id:        r.id,
        studentId: r.student_id,
        fullName:  r.full_name,
        level:     r.level,
        yearGroup: r.year_group,
        className: r.class_name,
        date:      r.date,
        status:    r.status,
        subject:   r.subject,
        notes:     r.notes,
      }))
    });

  } catch (error) {
    console.error('Get attendance error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// GET STUDENT ATTENDANCE
// GET /api/attendance/mine
// ══════════════════════════════════════════════
const getMyAttendance = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM attendance
       WHERE student_id = $1
       ORDER BY date DESC
       LIMIT 60`,
      [req.userId]
    );

    const total   = result.rows.length;
    const present = result.rows.filter(r => r.status === 'present').length;
    const absent  = result.rows.filter(r => r.status === 'absent').length;
    const late    = result.rows.filter(r => r.status === 'late').length;
    const rate    = total > 0 ? Math.round((present / total) * 100) : 0;

    return res.status(200).json({
      success: true,
      summary: { total, present, absent, late, attendanceRate: rate },
      records: result.rows.map(r => ({
        id:      r.id,
        date:    r.date,
        status:  r.status,
        subject: r.subject,
        notes:   r.notes,
      }))
    });

  } catch (error) {
    console.error('Get my attendance error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { markAttendance, getSchoolAttendance, getMyAttendance };