const pool = require('../config/db');

// ══════════════════════════════════════════════
// GET PAST QUESTIONS
// GET /api/questions
// ══════════════════════════════════════════════
const getPastQuestions = async (req, res) => {
  const { subject, level, examYear, examType, topic } = req.query;
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);

  try {
    let query = `
      SELECT id, subject, level, year_group, exam_year,
             question_text, option_a, option_b, option_c, option_d,
             correct_answer, explanation, exam_type, topic
      FROM past_questions
      WHERE 1=1
    `;
    const params = [];

    if (subject) {
      params.push(subject);
      query += ` AND subject = $${params.length}`;
    }
    if (level) {
      params.push(level.toUpperCase());
      query += ` AND level = $${params.length}`;
    }
    if (examYear) {
      params.push(examYear);
      query += ` AND exam_year = $${params.length}`;
    }
    if (examType) {
      params.push(examType.toUpperCase());
      query += ` AND exam_type = $${params.length}`;
    }
    if (topic) {
      params.push(topic);
      query += ` AND topic = $${params.length}`;
    }

    params.push(limit);
    query += ` ORDER BY exam_year DESC, subject ASC LIMIT $${params.length}`;

    const result = await pool.query(query, params);

    return res.status(200).json({
      success: true,
      total:   result.rows.length,
      questions: result.rows.map(q => ({
        id:           q.id,
        subject:      q.subject,
        level:        q.level,
        yearGroup:    q.year_group,
        examYear:     q.exam_year,
        questionText: q.question_text,
        options: {
          A: q.option_a,
          B: q.option_b,
          C: q.option_c,
          D: q.option_d,
        },
        correctAnswer: q.correct_answer,
        explanation:   q.explanation,
        examType:      q.exam_type,
        topic:         q.topic,
      }))
    });

  } catch (error) {
    console.error('Get past questions error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error — please try again'
    });
  }
};

// ══════════════════════════════════════════════
// GET SUBJECTS LIST
// GET /api/questions/subjects
// ══════════════════════════════════════════════
const getSubjects = async (req, res) => {
  const { level } = req.query;

  try {
    let query = `
      SELECT DISTINCT subject, exam_type,
      COUNT(*) as question_count
      FROM past_questions
    `;
    const params = [];

    if (level) {
      params.push(level.toUpperCase());
      query += ` WHERE level = $${params.length}`;
    }

    query += ` GROUP BY subject, exam_type ORDER BY subject`;

    const result = await pool.query(query, params);

    return res.status(200).json({
      success:  true,
      subjects: result.rows.map(s => ({
        subject:       s.subject,
        examType:      s.exam_type,
        questionCount: parseInt(s.question_count),
      }))
    });

  } catch (error) {
    console.error('Get subjects error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error — please try again'
    });
  }
};

// ══════════════════════════════════════════════
// GET SINGLE QUESTION
// GET /api/questions/:id
// ══════════════════════════════════════════════
const getQuestion = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT * FROM past_questions WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    const q = result.rows[0];

    return res.status(200).json({
      success: true,
      question: {
        id:           q.id,
        subject:      q.subject,
        level:        q.level,
        yearGroup:    q.year_group,
        examYear:     q.exam_year,
        questionText: q.question_text,
        options: {
          A: q.option_a,
          B: q.option_b,
          C: q.option_c,
          D: q.option_d,
        },
        correctAnswer: q.correct_answer,
        explanation:   q.explanation,
        examType:      q.exam_type,
        topic:         q.topic,
      }
    });

  } catch (error) {
    console.error('Get question error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error — please try again'
    });
  }
};

module.exports = { getPastQuestions, getSubjects, getQuestion };