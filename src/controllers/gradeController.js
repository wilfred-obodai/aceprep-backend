const pool = require('../config/db');

// ── Helper: Calculate grade letter ─────────────
const getGradeLetter = (percentage) => {
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 50) return 'D';
  if (percentage >= 40) return 'E';
  return 'F';
};

// ══════════════════════════════════════════════
// SUBMIT GRADE
// POST /api/grades/submit
// ══════════════════════════════════════════════
const submitGrade = async (req, res) => {
  const {
    subject,
    assessmentName,
    assessmentType,
    score,
    maxScore,
  } = req.body;

  if (!subject || !assessmentName || !assessmentType || score === undefined || !maxScore) {
    return res.status(400).json({
      success: false,
      message: 'Subject, assessment name, type, score and max score are required'
    });
  }

  if (score < 0 || score > maxScore) {
    return res.status(400).json({
      success: false,
      message: `Score must be between 0 and ${maxScore}`
    });
  }

  try {
    const studentResult = await pool.query(
      'SELECT school_id FROM students WHERE id = $1',
      [req.userId]
    );

    const schoolId    = studentResult.rows[0]?.school_id || null;
    const percentage  = parseFloat(((score / maxScore) * 100).toFixed(2));
    const gradeLetter = getGradeLetter(percentage);

    const result = await pool.query(
      `INSERT INTO grades
        (student_id, school_id, subject, assessment_name,
         assessment_type, score, max_score, percentage, grade_letter)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        req.userId, schoolId, subject, assessmentName,
        assessmentType, score, maxScore, percentage, gradeLetter
      ]
    );

    const grade = result.rows[0];

    return res.status(201).json({
      success: true,
      message: 'Grade submitted successfully!',
      grade: {
        id:             grade.id,
        subject:        grade.subject,
        assessmentName: grade.assessment_name,
        assessmentType: grade.assessment_type,
        score:          grade.score,
        maxScore:       grade.max_score,
        percentage:     grade.percentage,
        gradeLetter:    grade.grade_letter,
        takenAt:        grade.taken_at,
      }
    });

  } catch (error) {
    console.error('Submit grade error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error — please try again'
    });
  }
};

// ══════════════════════════════════════════════
// GET MY GRADES (Student)
// GET /api/grades/mine
// ══════════════════════════════════════════════
const getMyGrades = async (req, res) => {
  const { subject, assessmentType } = req.query;

  try {
    let query = `
      SELECT id, subject, assessment_name, assessment_type,
             score, max_score, percentage, grade_letter, taken_at
      FROM grades
      WHERE student_id = $1
    `;
    const params = [req.userId];

    if (subject) {
      params.push(subject);
      query += ` AND subject = $${params.length}`;
    }
    if (assessmentType) {
      params.push(assessmentType);
      query += ` AND assessment_type = $${params.length}`;
    }

    query += ` ORDER BY taken_at DESC`;

    const result = await pool.query(query, params);

    const average = result.rows.length > 0
      ? parseFloat(
          (result.rows.reduce((sum, g) => sum + parseFloat(g.percentage), 0) /
          result.rows.length).toFixed(2)
        )
      : 0;

    return res.status(200).json({
      success:      true,
      total:        result.rows.length,
      average,
      overallGrade: getGradeLetter(average),
      grades: result.rows.map(g => ({
        id:             g.id,
        subject:        g.subject,
        assessmentName: g.assessment_name,
        assessmentType: g.assessment_type,
        score:          parseFloat(g.score),
        maxScore:       parseFloat(g.max_score),
        percentage:     parseFloat(g.percentage),
        gradeLetter:    g.grade_letter,
        takenAt:        g.taken_at,
      }))
    });

  } catch (error) {
    console.error('Get my grades error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error — please try again'
    });
  }
};

// ══════════════════════════════════════════════
// GET ALL SCHOOL GRADES (School Admin)
// GET /api/schools/grades
// ══════════════════════════════════════════════
const getSchoolGrades = async (req, res) => {
  const { subject, assessmentType, yearGroup, className } = req.query;

  try {
    let query = `
      SELECT 
        g.id, g.subject, g.assessment_name, g.assessment_type,
        g.score, g.max_score, g.percentage, g.grade_letter, g.taken_at,
        s.id as student_id, s.full_name, s.email,
        s.level, s.year_group, s.class_name
      FROM grades g
      JOIN students s ON g.student_id = s.id
      WHERE g.school_id = $1
    `;
    const params = [req.schoolId];

    if (subject) {
      params.push(subject);
      query += ` AND g.subject = $${params.length}`;
    }
    if (assessmentType) {
      params.push(assessmentType);
      query += ` AND g.assessment_type = $${params.length}`;
    }
    if (yearGroup) {
      params.push(yearGroup);
      query += ` AND s.year_group = $${params.length}`;
    }
    if (className) {
      params.push(className);
      query += ` AND s.class_name = $${params.length}`;
    }

    query += ` ORDER BY g.taken_at DESC`;

    const result = await pool.query(query, params);

    return res.status(200).json({
      success: true,
      total:   result.rows.length,
      grades:  result.rows.map(g => ({
        id:             g.id,
        subject:        g.subject,
        assessmentName: g.assessment_name,
        assessmentType: g.assessment_type,
        score:          parseFloat(g.score),
        maxScore:       parseFloat(g.max_score),
        percentage:     parseFloat(g.percentage),
        gradeLetter:    g.grade_letter,
        takenAt:        g.taken_at,
        student: {
          id:        g.student_id,
          fullName:  g.full_name,
          email:     g.email,
          level:     g.level,
          yearGroup: g.year_group,
          className: g.class_name,
        }
      }))
    });

  } catch (error) {
    console.error('Get school grades error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error — please try again'
    });
  }
};

// ══════════════════════════════════════════════
// GET ONE STUDENT'S GRADES (School Admin)
// GET /api/schools/grades/:studentId
// ══════════════════════════════════════════════
const getStudentGrades = async (req, res) => {
  const { studentId } = req.params;

  try {
    // Verify student belongs to this school
    const studentCheck = await pool.query(
      `SELECT id, full_name, email, level, year_group, class_name 
       FROM students 
       WHERE id = $1 AND school_id = $2`,
      [studentId, req.schoolId]
    );

    if (studentCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found in your school'
      });
    }

    const student = studentCheck.rows[0];

    const gradesResult = await pool.query(
      `SELECT id, subject, assessment_name, assessment_type,
              score, max_score, percentage, grade_letter, taken_at
       FROM grades
       WHERE student_id = $1
       ORDER BY taken_at DESC`,
      [studentId]
    );

    // Calculate subject averages
    const subjectAverages = {};
    gradesResult.rows.forEach(g => {
      if (!subjectAverages[g.subject]) {
        subjectAverages[g.subject] = { total: 0, count: 0 };
      }
      subjectAverages[g.subject].total += parseFloat(g.percentage);
      subjectAverages[g.subject].count += 1;
    });

    const subjectSummary = Object.entries(subjectAverages).map(([subject, data]) => ({
      subject,
      average:     parseFloat((data.total / data.count).toFixed(2)),
      gradeLetter: getGradeLetter(data.total / data.count),
      totalTaken:  data.count,
    }));

    const overallAverage = gradesResult.rows.length > 0
      ? parseFloat(
          (gradesResult.rows.reduce((sum, g) => sum + parseFloat(g.percentage), 0) /
          gradesResult.rows.length).toFixed(2)
        )
      : 0;

    return res.status(200).json({
      success: true,
      student: {
        id:        student.id,
        fullName:  student.full_name,
        email:     student.email,
        level:     student.level,
        yearGroup: student.year_group,
        className: student.class_name,
      },
      summary: {
        totalAssessments: gradesResult.rows.length,
        overallAverage,
        overallGrade:     getGradeLetter(overallAverage),
        subjectSummary,
      },
      grades: gradesResult.rows.map(g => ({
        id:             g.id,
        subject:        g.subject,
        assessmentName: g.assessment_name,
        assessmentType: g.assessment_type,
        score:          parseFloat(g.score),
        maxScore:       parseFloat(g.max_score),
        percentage:     parseFloat(g.percentage),
        gradeLetter:    g.grade_letter,
        takenAt:        g.taken_at,
      }))
    });

  } catch (error) {
    console.error('Get student grades error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error — please try again'
    });
  }
};

module.exports = {
  submitGrade,
  getMyGrades,
  getSchoolGrades,
  getStudentGrades,
};