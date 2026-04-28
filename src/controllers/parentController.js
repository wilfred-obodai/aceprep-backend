const pool   = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');

const generateToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '30d' });

// ══════════════════════════════════════════════
// REGISTER PARENT
// POST /api/parents/register
// ══════════════════════════════════════════════
const registerParent = async (req, res) => {
  const { fullName, email, password, phone, studentCode } = req.body;

  if (!fullName || !email || !password || !studentCode) {
    return res.status(400).json({
      success: false,
      message: 'Full name, email, password and student code are required'
    });
  }

  try {
    // Find student by school code (parent enters child's school code)
    const studentResult = await pool.query(
      `SELECT s.id, s.full_name, s.school_id
       FROM students s
       JOIN schools sc ON sc.id = s.school_id
       WHERE sc.code = $1`,
      [studentCode.toUpperCase()]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found. Please check the school code.'
      });
    }

    const student = studentResult.rows[0];

    // Check if parent already registered
    const existing = await pool.query(
      'SELECT id FROM parents WHERE email = $1',
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists'
      });
    }

    const hashedPassword      = await bcrypt.hash(password, 12);
    const verificationToken   = crypto.randomBytes(32).toString('hex');

    const result = await pool.query(
      `INSERT INTO parents
        (student_id, full_name, email, password, phone,
         verification_token, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id, full_name, email`,
      [student.id, fullName, email, hashedPassword, phone, verificationToken]
    );

    return res.status(201).json({
      success: true,
      message: 'Parent account created! You can now login to monitor your child.',
      parent:  { id: result.rows[0].id, fullName, email }
    });

  } catch (error) {
    console.error('Register parent error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// LOGIN PARENT
// POST /api/parents/login
// ══════════════════════════════════════════════
const loginParent = async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query(
      `SELECT p.*, s.full_name as student_name,
               s.level, s.year_group, s.class_name,
               sc.name as school_name, sc.code as school_code
       FROM parents p
       JOIN students s ON s.id = p.student_id
       LEFT JOIN schools sc ON sc.id = s.school_id
       WHERE p.email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const parent  = result.rows[0];
    const isMatch = await bcrypt.compare(password, parent.password);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = generateToken(parent.id, 'parent');

    return res.status(200).json({
      success: true,
      message: 'Login successful!',
      token,
      parent: {
        id:          parent.id,
        fullName:    parent.full_name,
        email:       parent.email,
        studentId:   parent.student_id,
        studentName: parent.student_name,
        level:       parent.level,
        yearGroup:   parent.year_group,
        className:   parent.class_name,
        schoolName:  parent.school_name,
        schoolCode:  parent.school_code,
      }
    });

  } catch (error) {
    console.error('Parent login error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// GET CHILD PROGRESS (Parent)
// GET /api/parents/child-progress
// ══════════════════════════════════════════════
const getChildProgress = async (req, res) => {
  try {
    const parentResult = await pool.query(
      'SELECT student_id FROM parents WHERE id = $1',
      [req.userId]
    );

    const studentId = parentResult.rows[0]?.student_id;
    if (!studentId) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Get student info
    const studentResult = await pool.query(
      `SELECT s.*, sc.name as school_name
       FROM students s
       LEFT JOIN schools sc ON sc.id = s.school_id
       WHERE s.id = $1`,
      [studentId]
    );

    // Get grades
    const gradesResult = await pool.query(
      `SELECT subject, assessment_name, assessment_type,
              score, max_score, percentage, grade_letter, created_at
       FROM grades
       WHERE student_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [studentId]
    );

    // Get study sessions
    const sessionsResult = await pool.query(
      `SELECT started_at, ended_at, duration_minutes, device_type
       FROM study_sessions
       WHERE student_id = $1
       ORDER BY started_at DESC
       LIMIT 10`,
      [studentId]
    );

    // Get streak
    const streakResult = await pool.query(
      'SELECT * FROM study_streaks WHERE student_id = $1',
      [studentId]
    );

    // Get badges
    const badgesResult = await pool.query(
      'SELECT * FROM badges WHERE student_id = $1 ORDER BY earned_at DESC',
      [studentId]
    );

    // Calculate stats
    const grades       = gradesResult.rows;
    const avgScore     = grades.length > 0
      ? parseFloat((grades.reduce((s, g) => s + parseFloat(g.percentage), 0) / grades.length).toFixed(1))
      : 0;
    const overallGrade = avgScore >= 80 ? 'A' : avgScore >= 70 ? 'B' : avgScore >= 60 ? 'C' :
                         avgScore >= 50 ? 'D' : avgScore >= 40 ? 'E' : 'F';

    const student = studentResult.rows[0];

    return res.status(200).json({
      success: true,
      student: {
        id:         student.id,
        fullName:   student.full_name,
        email:      student.email,
        level:      student.level,
        yearGroup:  student.year_group,
        className:  student.class_name,
        schoolName: student.school_name,
      },
      performance: {
        averageScore:     avgScore,
        overallGrade,
        totalAssessments: grades.length,
        recentGrades:     grades.slice(0, 5).map(g => ({
          subject:        g.subject,
          assessmentName: g.assessment_name,
          score:          g.score,
          maxScore:       g.max_score,
          percentage:     g.percentage,
          gradeLetter:    g.grade_letter,
          date:           g.created_at,
        })),
      },
      studyActivity: {
        totalSessions: sessionsResult.rows.length,
        recentSessions: sessionsResult.rows.map(s => ({
          startedAt:       s.started_at,
          endedAt:         s.ended_at,
          durationMinutes: s.duration_minutes,
          deviceType:      s.device_type,
        })),
        streak: streakResult.rows[0] ? {
          currentStreak: streakResult.rows[0].current_streak,
          longestStreak: streakResult.rows[0].longest_streak,
          totalDays:     streakResult.rows[0].total_days,
        } : { currentStreak: 0, longestStreak: 0, totalDays: 0 },
      },
      badges: badgesResult.rows.map(b => ({
        name:        b.badge_name,
        description: b.description,
        earnedAt:    b.earned_at,
      })),
    });

  } catch (error) {
    console.error('Child progress error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { registerParent, loginParent, getChildProgress };