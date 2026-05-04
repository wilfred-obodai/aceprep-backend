const pool = require('../config/db');
const jwt  = require('jsonwebtoken');

const generateToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '30d' });

const getChildProgress = async (req, res) => {
  try {
    const parentId     = req.userId;
    const parentResult = await pool.query('SELECT * FROM parents WHERE id = $1', [parentId]);
    if (parentResult.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Parent not found' });

    const parent = parentResult.rows[0];
    if (!parent.student_id && !parent.child_email)
      return res.json({ success: true, student: null, stats: null });

    const studentResult = await pool.query(
      `SELECT s.*, sc.name as school_name, sc.code as school_code
       FROM students s LEFT JOIN schools sc ON s.school_id = sc.id
       WHERE s.id = $1 OR s.email = $2 LIMIT 1`,
      [parent.student_id || 0, parent.child_email || '']
    );

    if (studentResult.rows.length === 0)
      return res.json({ success: true, student: null, stats: null });

    const student = studentResult.rows[0];

    const [gradesRes, attRes, streakRes, examRes, recentRes] = await Promise.all([
      pool.query('SELECT AVG(percentage) as avg_score FROM grades WHERE student_id = $1', [student.id]),
      pool.query(`SELECT COUNT(*) FILTER (WHERE status='present') as present, COUNT(*) FILTER (WHERE status='absent') as absent, COUNT(*) FILTER (WHERE status='late') as late, COUNT(*) as total FROM attendance WHERE student_id = $1`, [student.id]),
      pool.query('SELECT current_streak FROM study_streaks WHERE student_id = $1', [student.id]),
      pool.query('SELECT COUNT(*) as total FROM exam_attempts WHERE student_id = $1', [student.id]),
      pool.query(`SELECT subject, percentage as score, grade_letter as grade, created_at FROM grades WHERE student_id = $1 ORDER BY created_at DESC LIMIT 5`, [student.id]),
    ]);

    const att        = attRes.rows[0];
    const attPercent = att.total > 0 ? Math.round((att.present / att.total) * 100) : 0;

    return res.json({
      success: true,
      student: {
        id: student.id, fullName: student.full_name, email: student.email,
        level: student.level, yearGroup: student.year_group, className: student.class_name,
        schoolName: student.school_name, schoolCode: student.school_code,
      },
      stats: {
        avgScore:   Math.round(gradesRes.rows[0]?.avg_score || 0),
        examsTaken: parseInt(examRes.rows[0]?.total || 0),
        attendance: attPercent,
        streak:     streakRes.rows[0]?.current_streak || 0,
      },
      recentGrades: recentRes.rows,
    });
  } catch (error) {
    console.error('Get child progress error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getChildGrades = async (req, res) => {
  try {
    const parentId = req.userId;
    const parent   = await pool.query('SELECT * FROM parents WHERE id = $1', [parentId]);
    if (parent.rows.length === 0) return res.status(404).json({ success: false, message: 'Parent not found' });

    const p = parent.rows[0];
    if (!p.student_id && !p.child_email) return res.json({ success: true, grades: [] });

    const studentRes = await pool.query(
      'SELECT id FROM students WHERE id = $1 OR email = $2 LIMIT 1',
      [p.student_id || 0, p.child_email || '']
    );
    if (studentRes.rows.length === 0) return res.json({ success: true, grades: [] });

    const grades = await pool.query(
      `SELECT subject, percentage as score, grade_letter as grade,
              assessment_name, assessment_type, created_at
       FROM grades WHERE student_id = $1 ORDER BY created_at DESC`,
      [studentRes.rows[0].id]
    );
    return res.json({ success: true, grades: grades.rows });
  } catch (error) {
    console.error('Get child grades error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getChildAttendance = async (req, res) => {
  try {
    const parentId = req.userId;
    const parent   = await pool.query('SELECT * FROM parents WHERE id = $1', [parentId]);
    if (parent.rows.length === 0) return res.status(404).json({ success: false, message: 'Parent not found' });

    const p = parent.rows[0];
    if (!p.student_id && !p.child_email)
      return res.json({ success: true, records: [], stats: { present: 0, absent: 0, late: 0 } });

    const studentRes = await pool.query(
      'SELECT id FROM students WHERE id = $1 OR email = $2 LIMIT 1',
      [p.student_id || 0, p.child_email || '']
    );
    if (studentRes.rows.length === 0)
      return res.json({ success: true, records: [], stats: { present: 0, absent: 0, late: 0 } });

    const sid = studentRes.rows[0].id;
    const [records, stats] = await Promise.all([
      pool.query('SELECT * FROM attendance WHERE student_id = $1 ORDER BY date DESC', [sid]),
      pool.query(`SELECT COUNT(*) FILTER (WHERE status='present') as present, COUNT(*) FILTER (WHERE status='absent') as absent, COUNT(*) FILTER (WHERE status='late') as late FROM attendance WHERE student_id = $1`, [sid]),
    ]);
    return res.json({ success: true, records: records.rows, stats: stats.rows[0] });
  } catch (error) {
    console.error('Get child attendance error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const linkChild = async (req, res) => {
  try {
    const parentId     = req.userId;
    const { childEmail } = req.body;
    if (!childEmail) return res.status(400).json({ success: false, message: 'Child email is required' });

    const studentRes = await pool.query(
      'SELECT id, full_name, school_id FROM students WHERE email = $1', [childEmail]
    );
    if (studentRes.rows.length === 0)
      return res.status(404).json({ success: false, message: 'No student found with that email' });

    const student = studentRes.rows[0];
    await pool.query(
      'UPDATE parents SET student_id = $1, child_email = $2, school_id = $3 WHERE id = $4',
      [student.id, childEmail, student.school_id, parentId]
    );
    return res.json({ success: true, message: `Successfully linked to ${student.full_name}` });
  } catch (error) {
    console.error('Link child error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getSchoolTeachers = async (req, res) => {
  try {
    const parentId = req.userId;
    const parent   = await pool.query('SELECT school_id FROM parents WHERE id = $1', [parentId]);

    if (parent.rows.length === 0 || !parent.rows[0].school_id)
      return res.json({ success: true, teachers: [] });

    const teachers = await pool.query(
      `SELECT id, full_name, email, role, phone FROM teachers
       WHERE school_id = $1 AND is_verified = true ORDER BY role, full_name`,
      [parent.rows[0].school_id]
    );

    return res.json({
      success:  true,
      teachers: teachers.rows.map(t => ({
        id: t.id, fullName: t.full_name, email: t.email, role: t.role, phone: t.phone,
      }))
    });
  } catch (error) {
    console.error('Get school teachers error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getChildProgress,
  getChildGrades,
  getChildAttendance,
  linkChild,
  getSchoolTeachers,
};