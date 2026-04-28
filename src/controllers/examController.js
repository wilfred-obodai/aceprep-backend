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
// CREATE EXAM (Teacher/Admin)
// POST /api/exams
// ══════════════════════════════════════════════
const createExam = async (req, res) => {
  const {
    title, subject, instructions, durationMins,
    totalMarks, level, yearGroup, className,
    startsAt, endsAt, questions
  } = req.body;

  if (!title || !subject || !questions || questions.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Title, subject and at least one question are required'
    });
  }

  try {
    // Create exam
    const examResult = await pool.query(
      `INSERT INTO exams
        (school_id, teacher_id, title, subject, instructions,
         duration_mins, total_marks, level, year_group,
         class_name, status, starts_at, ends_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        req.schoolId, req.userId, title, subject, instructions,
        durationMins || 60, totalMarks || questions.length,
        level, yearGroup, className,
        startsAt ? 'published' : 'draft',
        startsAt || null, endsAt || null
      ]
    );

    const exam = examResult.rows[0];

    // Insert questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      await pool.query(
        `INSERT INTO exam_questions
          (exam_id, question_text, option_a, option_b,
           option_c, option_d, correct_answer, marks, question_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          exam.id, q.questionText, q.optionA, q.optionB,
          q.optionC, q.optionD, q.correctAnswer,
          q.marks || 1, i + 1
        ]
      );
    }

    return res.status(201).json({
      success: true,
      message: 'Exam created successfully!',
      exam: {
        id:        exam.id,
        title:     exam.title,
        subject:   exam.subject,
        status:    exam.status,
        totalMarks: exam.total_marks,
        durationMins: exam.duration_mins,
      }
    });

  } catch (error) {
    console.error('Create exam error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// GET SCHOOL EXAMS (Teacher/Admin)
// GET /api/exams/school
// ══════════════════════════════════════════════
const getSchoolExams = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*,
        COUNT(DISTINCT eq.id) as question_count,
        COUNT(DISTINCT ea.id) as attempt_count
       FROM exams e
       LEFT JOIN exam_questions eq ON eq.exam_id = e.id
       LEFT JOIN exam_attempts ea  ON ea.exam_id = e.id
       WHERE e.school_id = $1
       GROUP BY e.id
       ORDER BY e.created_at DESC`,
      [req.schoolId]
    );

    return res.status(200).json({
      success: true,
      total: result.rows.length,
      exams: result.rows.map(e => ({
        id:            e.id,
        title:         e.title,
        subject:       e.subject,
        instructions:  e.instructions,
        durationMins:  e.duration_mins,
        totalMarks:    e.total_marks,
        level:         e.level,
        yearGroup:     e.year_group,
        className:     e.class_name,
        status:        e.status,
        startsAt:      e.starts_at,
        endsAt:        e.ends_at,
        createdAt:     e.created_at,
        questionCount: parseInt(e.question_count),
        attemptCount:  parseInt(e.attempt_count),
      }))
    });
  } catch (error) {
    console.error('Get school exams error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// GET STUDENT EXAMS (Student)
// GET /api/exams/student
// ══════════════════════════════════════════════
const getStudentExams = async (req, res) => {
  try {
    // Get student info
    const studentResult = await pool.query(
      'SELECT school_id, level, year_group, class_name FROM students WHERE id = $1',
      [req.userId]
    );

    const student = studentResult.rows[0];

    if (!student?.school_id) {
      return res.status(200).json({
        success: true,
        total: 0,
        exams: [],
        message: 'No exams available — you are not linked to a school'
      });
    }

    // Get published exams for this student's school/class
    const result = await pool.query(
      `SELECT e.*,
        COUNT(DISTINCT eq.id) as question_count,
        ea.id as attempt_id,
        ea.status as attempt_status,
        ea.score as attempt_score,
        ea.percentage as attempt_percentage,
        ea.grade_letter as attempt_grade
       FROM exams e
       LEFT JOIN exam_questions eq ON eq.exam_id = e.id
       LEFT JOIN exam_attempts ea  ON ea.exam_id = e.id
                                   AND ea.student_id = $1
       WHERE e.school_id = $2
         AND e.status = 'published'
         AND (e.level IS NULL OR e.level = $3)
         AND (e.year_group IS NULL OR e.year_group = $4)
         AND (e.class_name IS NULL OR e.class_name = $5)
       GROUP BY e.id, ea.id
       ORDER BY e.created_at DESC`,
      [
        req.userId, student.school_id,
        student.level, student.year_group, student.class_name
      ]
    );

    return res.status(200).json({
      success: true,
      total: result.rows.length,
      exams: result.rows.map(e => ({
        id:            e.id,
        title:         e.title,
        subject:       e.subject,
        instructions:  e.instructions,
        durationMins:  e.duration_mins,
        totalMarks:    e.total_marks,
        level:         e.level,
        yearGroup:     e.year_group,
        className:     e.class_name,
        status:        e.status,
        startsAt:      e.starts_at,
        endsAt:        e.ends_at,
        questionCount: parseInt(e.question_count),
        attempt: e.attempt_id ? {
          id:         e.attempt_id,
          status:     e.attempt_status,
          score:      e.attempt_score,
          percentage: e.attempt_percentage,
          grade:      e.attempt_grade,
        } : null
      }))
    });
  } catch (error) {
    console.error('Get student exams error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// GET EXAM QUESTIONS (Student taking exam)
// GET /api/exams/:id/questions
// ══════════════════════════════════════════════
const getExamQuestions = async (req, res) => {
  const { id } = req.params;

  try {
    // Get exam details
    const examResult = await pool.query(
      'SELECT * FROM exams WHERE id = $1',
      [id]
    );

    if (examResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Exam not found' });
    }

    const exam = examResult.rows[0];

    // Check if student already completed this exam
    const attemptResult = await pool.query(
      `SELECT * FROM exam_attempts
       WHERE exam_id = $1 AND student_id = $2 AND status = 'completed'`,
      [id, req.userId]
    );

    if (attemptResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You have already completed this exam'
      });
    }

    // Get questions — WITHOUT correct answers for students
    const questionsResult = await pool.query(
      `SELECT id, question_text, option_a, option_b,
              option_c, option_d, marks, question_order
       FROM exam_questions
       WHERE exam_id = $1
       ORDER BY question_order`,
      [id]
    );

    // Create or get existing attempt
    let attempt = await pool.query(
      `SELECT * FROM exam_attempts
       WHERE exam_id = $1 AND student_id = $2 AND status = 'in_progress'`,
      [id, req.userId]
    );

    if (attempt.rows.length === 0) {
      attempt = await pool.query(
        `INSERT INTO exam_attempts (exam_id, student_id, school_id, total_marks)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [id, req.userId, exam.school_id, exam.total_marks]
      );
    }

    return res.status(200).json({
      success: true,
      exam: {
        id:           exam.id,
        title:        exam.title,
        subject:      exam.subject,
        instructions: exam.instructions,
        durationMins: exam.duration_mins,
        totalMarks:   exam.total_marks,
      },
      attemptId: attempt.rows[0].id,
      questions: questionsResult.rows.map(q => ({
        id:           q.id,
        questionText: q.question_text,
        options: {
          A: q.option_a,
          B: q.option_b,
          C: q.option_c,
          D: q.option_d,
        },
        marks:         q.marks,
        questionOrder: q.question_order,
      }))
    });

  } catch (error) {
    console.error('Get exam questions error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// SUBMIT EXAM (Student)
// POST /api/exams/:id/submit
// ══════════════════════════════════════════════
const submitExam = async (req, res) => {
  const { id } = req.params;
  const { attemptId, answers, timeTaken } = req.body;

  if (!attemptId || !answers) {
    return res.status(400).json({
      success: false,
      message: 'Attempt ID and answers are required'
    });
  }

  try {
    // Get correct answers
    const questionsResult = await pool.query(
      'SELECT id, correct_answer, marks FROM exam_questions WHERE exam_id = $1',
      [id]
    );

    const questions = questionsResult.rows;
    let score = 0;
    let totalMarks = 0;

    // Save each answer and calculate score
    for (const question of questions) {
      const studentAnswer = answers[question.id];
      const isCorrect = studentAnswer === question.correct_answer;

      if (isCorrect) score += question.marks;
      totalMarks += question.marks;

      // Save answer
      await pool.query(
        `INSERT INTO exam_answers
          (attempt_id, exam_question_id, selected_answer, is_correct)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [attemptId, question.id, studentAnswer || null, isCorrect]
      );
    }

    const percentage   = parseFloat(((score / totalMarks) * 100).toFixed(2));
    const gradeLetter  = getGradeLetter(percentage);

    // Update attempt
    const attemptResult = await pool.query(
      `UPDATE exam_attempts
       SET submitted_at = NOW(),
           score        = $1,
           total_marks  = $2,
           percentage   = $3,
           grade_letter = $4,
           status       = 'completed',
           time_taken   = $5
       WHERE id = $6
       RETURNING *`,
      [score, totalMarks, percentage, gradeLetter, timeTaken || 0, attemptId]
    );

    const attempt = attemptResult.rows[0];

    // Also save to grades table for school dashboard visibility
    await pool.query(
      `INSERT INTO grades
        (student_id, school_id, subject, assessment_name,
         assessment_type, score, max_score, percentage, grade_letter)
       SELECT
        $1,
        (SELECT school_id FROM exams WHERE id = $2),
        subject, title, 'exam', $3, $4, $5, $6
       FROM exams WHERE id = $2`,
      [req.userId, id, score, totalMarks, percentage, gradeLetter]
    );

    return res.status(200).json({
      success:     true,
      message:     'Exam submitted successfully!',
      result: {
        score,
        totalMarks,
        percentage,
        gradeLetter,
        timeTaken:   attempt.time_taken,
        submittedAt: attempt.submitted_at,
      }
    });

  } catch (error) {
    console.error('Submit exam error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// GET EXAM RESULTS (School Admin)
// GET /api/exams/:id/results
// ══════════════════════════════════════════════
const getExamResults = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT
        ea.*,
        s.full_name, s.email, s.level, s.year_group, s.class_name
       FROM exam_attempts ea
       JOIN students s ON ea.student_id = s.id
       WHERE ea.exam_id = $1 AND ea.school_id = $2
       ORDER BY ea.percentage DESC NULLS LAST`,
      [id, req.schoolId]
    );

    // Get exam info
    const examResult = await pool.query(
      'SELECT * FROM exams WHERE id = $1',
      [id]
    );

    const exam = examResult.rows[0];
    const completed = result.rows.filter(r => r.status === 'completed');
    const avgScore  = completed.length > 0
      ? parseFloat((completed.reduce((s, r) => s + parseFloat(r.percentage || 0), 0) / completed.length).toFixed(2))
      : 0;

    return res.status(200).json({
      success: true,
      exam: {
        id:      exam.id,
        title:   exam.title,
        subject: exam.subject,
      },
      summary: {
        totalAttempts:    result.rows.length,
        completed:        completed.length,
        averageScore:     avgScore,
        highestScore:     completed.length > 0 ? parseFloat(completed[0].percentage) : 0,
        lowestScore:      completed.length > 0 ? parseFloat(completed[completed.length-1].percentage) : 0,
      },
      results: result.rows.map(r => ({
        studentId:   r.student_id,
        fullName:    r.full_name,
        email:       r.email,
        level:       r.level,
        yearGroup:   r.year_group,
        className:   r.class_name,
        score:       r.score,
        totalMarks:  r.total_marks,
        percentage:  r.percentage,
        gradeLetter: r.grade_letter,
        timeTaken:   r.time_taken,
        status:      r.status,
        submittedAt: r.submitted_at,
      }))
    });

  } catch (error) {
    console.error('Get exam results error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  createExam,
  getSchoolExams,
  getStudentExams,
  getExamQuestions,
  submitExam,
  getExamResults,
};