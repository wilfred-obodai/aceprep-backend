const pool = require('../config/db');

// ── Helper: Grade letter ─────────────────────────
const getGradeLetter = (percentage) => {
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 50) return 'D';
  if (percentage >= 40) return 'E';
  return 'F';
};

// ══════════════════════════════════════════════
// CREATE ASSIGNMENT (Teacher/Admin)
// POST /api/assignments
// ══════════════════════════════════════════════
const createAssignment = async (req, res) => {
  const {
    title, description, subject,
    level, yearGroup, className,
    dueDate, totalMarks
  } = req.body;

  if (!title || !description || !subject) {
    return res.status(400).json({
      success: false,
      message: 'Title, description and subject are required'
    });
  }

  try {
    const result = await pool.query(
  `INSERT INTO assignments
    (school_id, teacher_id, title, description, subject,
     level, year_group, class_name, due_date, total_marks, status)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'published')
   RETURNING *`,
  [
    req.schoolId, req.userId, title, description, subject,
    level, yearGroup, className,
    dueDate || null, totalMarks || 100
  ]
);

    return res.status(201).json({
      success:    true,
      message:    'Assignment created successfully!',
      assignment: result.rows[0]
    });

  } catch (error) {
    console.error('Create assignment error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// GET SCHOOL ASSIGNMENTS (Teacher/Admin)
// GET /api/assignments/school
// ══════════════════════════════════════════════
const getSchoolAssignments = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*,
        t.full_name as teacher_name,
        COUNT(DISTINCT s.id) as submission_count
       FROM assignments a
       LEFT JOIN teachers t ON t.id = a.teacher_id
       LEFT JOIN assignment_submissions s ON s.assignment_id = a.id
       WHERE a.school_id = $1
       GROUP BY a.id, t.full_name
       ORDER BY a.created_at DESC`,
      [req.schoolId]
    );

    return res.status(200).json({
      success:     true,
      total:       result.rows.length,
      assignments: result.rows.map(a => ({
        id:              a.id,
        title:           a.title,
        description:     a.description,
        subject:         a.subject,
        level:           a.level,
        yearGroup:       a.year_group,
        className:       a.class_name,
        dueDate:         a.due_date,
        totalMarks:      a.total_marks,
        status:          a.status,
        teacherName:     a.teacher_name,
        submissionCount: parseInt(a.submission_count),
        createdAt:       a.created_at,
      }))
    });

  } catch (error) {
    console.error('Get school assignments error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// GET STUDENT ASSIGNMENTS
// GET /api/assignments/student
// ══════════════════════════════════════════════
const getStudentAssignments = async (req, res) => {
  try {
    const studentResult = await pool.query(
      'SELECT school_id, level, year_group, class_name FROM students WHERE id = $1',
      [req.userId]
    );

    const student = studentResult.rows[0];

    if (!student?.school_id) {
      return res.status(200).json({
        success:     true,
        total:       0,
        assignments: [],
        message:     'No assignments — you are not linked to a school'
      });
    }

    const result = await pool.query(
      `SELECT a.*,
        t.full_name as teacher_name,
        sub.id as submission_id,
        sub.answer_text,
        sub.marks_awarded,
        sub.feedback,
        sub.status as submission_status,
        sub.submitted_at
       FROM assignments a
       LEFT JOIN teachers t ON t.id = a.teacher_id
       LEFT JOIN assignment_submissions sub
         ON sub.assignment_id = a.id AND sub.student_id = $1
       WHERE a.school_id = $2
         AND a.status = 'published'
         AND (a.level IS NULL OR a.level = $3)
         AND (a.year_group IS NULL OR a.year_group = $4)
       ORDER BY a.due_date ASC NULLS LAST, a.created_at DESC`,
      [req.userId, student.school_id, student.level, student.year_group]
    );

    return res.status(200).json({
      success:     true,
      total:       result.rows.length,
      assignments: result.rows.map(a => ({
        id:          a.id,
        title:       a.title,
        description: a.description,
        subject:     a.subject,
        level:       a.level,
        yearGroup:   a.year_group,
        className:   a.class_name,
        dueDate:     a.due_date,
        totalMarks:  a.total_marks,
        teacherName: a.teacher_name,
        submission:  a.submission_id ? {
          id:         a.submission_id,
          answerText: a.answer_text,
          marks:      a.marks_awarded,
          feedback:   a.feedback,
          status:     a.submission_status,
          submittedAt: a.submitted_at,
        } : null
      }))
    });

  } catch (error) {
    console.error('Get student assignments error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// SUBMIT ASSIGNMENT (Student)
// POST /api/assignments/:id/submit
// ══════════════════════════════════════════════
const submitAssignment = async (req, res) => {
  const { id }         = req.params;
  const { answerText } = req.body;

  if (!answerText || !answerText.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Answer text is required'
    });
  }

  try {
    // Check if already submitted
    const existing = await pool.query(
      'SELECT id FROM assignment_submissions WHERE assignment_id = $1 AND student_id = $2',
      [id, req.userId]
    );

    if (existing.rows.length > 0) {
      // Update existing submission
      await pool.query(
        `UPDATE assignment_submissions
         SET answer_text = $1, submitted_at = NOW(), status = 'submitted'
         WHERE assignment_id = $2 AND student_id = $3`,
        [answerText.trim(), id, req.userId]
      );
    } else {
      // Get student school_id
      const studentRes = await pool.query(
        'SELECT school_id FROM students WHERE id = $1',
        [req.userId]
      );

      await pool.query(
        `INSERT INTO assignment_submissions
          (assignment_id, student_id, school_id, answer_text, status)
         VALUES ($1, $2, $3, $4, 'submitted')`,
        [id, req.userId, studentRes.rows[0].school_id, answerText.trim()]
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Assignment submitted successfully!'
    });

  } catch (error) {
    console.error('Submit assignment error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// GET ASSIGNMENT SUBMISSIONS (Teacher/Admin)
// GET /api/assignments/:id/submissions
// ══════════════════════════════════════════════
const getSubmissions = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT
        sub.*,
        s.full_name, s.email, s.level, s.year_group, s.class_name
       FROM assignment_submissions sub
       JOIN students s ON sub.student_id = s.id
       WHERE sub.assignment_id = $1
         AND sub.school_id = $2
       ORDER BY sub.submitted_at DESC`,
      [id, req.schoolId]
    );

    const assignment = await pool.query(
      'SELECT * FROM assignments WHERE id = $1',
      [id]
    );

    return res.status(200).json({
      success:     true,
      assignment:  assignment.rows[0],
      total:       result.rows.length,
      submissions: result.rows.map(s => ({
        id:          s.id,
        studentId:   s.student_id,
        fullName:    s.full_name,
        email:       s.email,
        level:       s.level,
        yearGroup:   s.year_group,
        className:   s.class_name,
        answerText:  s.answer_text,
        marksAwarded: s.marks_awarded,
        feedback:    s.feedback,
        status:      s.status,
        submittedAt: s.submitted_at,
        gradedAt:    s.graded_at,
      }))
    });

  } catch (error) {
    console.error('Get submissions error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// GRADE SUBMISSION (Teacher/Admin)
// POST /api/assignments/submissions/:id/grade
// ══════════════════════════════════════════════
const gradeSubmission = async (req, res) => {
  const { id }                   = req.params;
  const { marksAwarded, feedback } = req.body;

  if (marksAwarded === undefined || marksAwarded === null) {
    return res.status(400).json({
      success: false,
      message: 'Marks awarded is required'
    });
  }

  try {
    // Get submission and assignment
    const subResult = await pool.query(
      `SELECT sub.*, a.total_marks, a.subject, a.title
       FROM assignment_submissions sub
       JOIN assignments a ON a.id = sub.assignment_id
       WHERE sub.id = $1`,
      [id]
    );

    if (subResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    const sub        = subResult.rows[0];
    const percentage = parseFloat(((marksAwarded / sub.total_marks) * 100).toFixed(2));
    const grade      = getGradeLetter(percentage);

    // Update submission
    await pool.query(
      `UPDATE assignment_submissions
       SET marks_awarded = $1,
           feedback      = $2,
           status        = 'graded',
           graded_at     = NOW(),
           graded_by     = $3
       WHERE id = $4`,
      [marksAwarded, feedback || null, req.userId, id]
    );

    // Save to grades table
    await pool.query(
      `INSERT INTO grades
        (student_id, school_id, subject, assessment_name,
         assessment_type, score, max_score, percentage, grade_letter)
       VALUES ($1, $2, $3, $4, 'assignment', $5, $6, $7, $8)
       ON CONFLICT DO NOTHING`,
      [
        sub.student_id, sub.school_id,
        sub.subject, sub.title,
        marksAwarded, sub.total_marks, percentage, grade
      ]
    );

    return res.status(200).json({
      success:    true,
      message:    'Submission graded successfully!',
      percentage,
      grade
    });

  } catch (error) {
    console.error('Grade submission error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  createAssignment,
  getSchoolAssignments,
  getStudentAssignments,
  submitAssignment,
  getSubmissions,
  gradeSubmission,
};