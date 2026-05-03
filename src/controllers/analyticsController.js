const pool = require('../config/db');

// ══════════════════════════════════════════════
// GET STUDENT SELF ANALYTICS
// GET /api/analytics/mine
// ══════════════════════════════════════════════
const getMyAnalytics = async (req, res) => {
  const studentId = req.params.studentId || req.userId;

  try {
    const gradesResult = await pool.query(
      `SELECT subject, assessment_type, percentage, grade_letter, created_at
       FROM grades WHERE student_id = $1 ORDER BY created_at ASC`,
      [studentId]
    );

    const grades = gradesResult.rows;

    const subjectMap = grades.reduce((acc, g) => {
      if (!acc[g.subject]) acc[g.subject] = [];
      acc[g.subject].push(parseFloat(g.percentage));
      return acc;
    }, {});

    const subjectAverages = Object.entries(subjectMap).map(([subject, scores]) => {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      return {
        subject,
        average:  parseFloat(avg.toFixed(1)),
        count:    scores.length,
        highest:  Math.max(...scores),
        lowest:   Math.min(...scores),
        grade:    avg >= 80 ? 'A' : avg >= 70 ? 'B' : avg >= 60 ? 'C' : avg >= 50 ? 'D' : 'F',
      };
    }).sort((a, b) => a.average - b.average);

    const weakSubjects   = subjectAverages.filter(s => s.average < 60);
    const strongSubjects = subjectAverages.filter(s => s.average >= 70);

    const allScores  = grades.map(g => parseFloat(g.percentage));
    const overallAvg = allScores.length > 0
      ? parseFloat((allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1))
      : 0;

    const trend = grades.slice(-10).map(g => ({
      subject:    g.subject,
      percentage: parseFloat(g.percentage),
      date:       g.created_at,
    }));

    const sessionsResult = await pool.query(
      `SELECT DATE(login_at) as date,
              SUM(duration_minutes) as total_minutes,
              COUNT(*) as session_count
       FROM study_sessions
       WHERE student_id = $1 AND login_at >= NOW() - INTERVAL '30 days'
       GROUP BY DATE(login_at) ORDER BY date ASC`,
      [studentId]
    );

    const totalStudyMins = sessionsResult.rows.reduce(
      (sum, r) => sum + parseInt(r.total_minutes || 0), 0
    );

    let recommendations = [];
    if (weakSubjects.length > 0) {
      recommendations = weakSubjects.slice(0, 3).map(s => ({
        subject: s.subject,
        average: s.average,
        tip: s.average < 40
          ? `🚨 Critical: Focus heavily on ${s.subject}. Practice past questions daily.`
          : `⚠️ Needs work: Spend more time on ${s.subject} exercises and examples.`
      }));
    }
    if (recommendations.length === 0) {
      recommendations.push({
        subject: 'General',
        average: overallAvg,
        tip: '🌟 Great performance! Keep practicing to maintain your grades.'
      });
    }

    return res.status(200).json({
      success: true,
      analytics: {
        overallAverage:   overallAvg,
        totalAssessments: grades.length,
        totalStudyMins,
        subjectAverages,
        weakSubjects:     weakSubjects.slice(0, 3),
        strongSubjects:   strongSubjects.slice(-3),
        trend,
        studyActivity:    sessionsResult.rows.map(r => ({
          date:         r.date,
          totalMinutes: parseInt(r.total_minutes || 0),
          sessions:     parseInt(r.session_count),
        })),
        recommendations,
      }
    });

  } catch (error) {
    console.error('Analytics error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// GET SCHOOL ANALYTICS (Admin view of student)
// GET /api/analytics/student/:studentId
// ══════════════════════════════════════════════
const getStudentAnalytics = async (req, res) => {
  req.userId = req.params.studentId;
  return getMyAnalytics(req, res);
};

// ══════════════════════════════════════════════
// GET SCHOOL REPORT (Admin)
// GET /api/analytics/school-report
// ══════════════════════════════════════════════
const getSchoolReport = async (req, res) => {
  try {
    const schoolId = req.schoolId;

    const [students, avgScore, subjectPerf, topStudents, bottomStudents, exams, attendance, yearGroups] = await Promise.all([
      pool.query(
        'SELECT COUNT(*) as total FROM students WHERE school_id = $1',
        [schoolId]
      ),
      pool.query(
        `SELECT AVG(g.percentage) as avg FROM grades g
         JOIN students s ON g.student_id = s.id WHERE s.school_id = $1`,
        [schoolId]
      ),
      pool.query(
        `SELECT subject, AVG(percentage) as avg_score FROM grades g
         JOIN students s ON g.student_id = s.id
         WHERE s.school_id = $1 GROUP BY subject ORDER BY avg_score DESC`,
        [schoolId]
      ),
      pool.query(
        `SELECT s.full_name, AVG(g.percentage) as avg_score FROM grades g
         JOIN students s ON g.student_id = s.id
         WHERE s.school_id = $1 GROUP BY s.id, s.full_name
         ORDER BY avg_score DESC LIMIT 5`,
        [schoolId]
      ),
      pool.query(
        `SELECT s.full_name, AVG(g.percentage) as avg_score FROM grades g
         JOIN students s ON g.student_id = s.id
         WHERE s.school_id = $1 GROUP BY s.id, s.full_name
         ORDER BY avg_score ASC LIMIT 5`,
        [schoolId]
      ),
      pool.query(
        'SELECT COUNT(*) as total FROM exams WHERE school_id = $1',
        [schoolId]
      ),
      pool.query(
        `SELECT AVG(CASE WHEN a.status = 'present' THEN 100 ELSE 0 END) as avg
         FROM attendance a JOIN students s ON a.student_id = s.id
         WHERE s.school_id = $1`,
        [schoolId]
      ),
      pool.query(
        `SELECT year_group, AVG(g.percentage) as avg_score,
                COUNT(DISTINCT s.id) as student_count
         FROM grades g JOIN students s ON g.student_id = s.id
         WHERE s.school_id = $1 GROUP BY year_group ORDER BY year_group`,
        [schoolId]
      ),
    ]);

    return res.json({
      success:              true,
      totalStudents:        parseInt(students.rows[0]?.total || 0),
      avgScore:             Math.round(avgScore.rows[0]?.avg || 0),
      totalExams:           parseInt(exams.rows[0]?.total || 0),
      avgAttendance:        Math.round(attendance.rows[0]?.avg || 0),
      subjectPerformance:   subjectPerf.rows,
      topStudents:          topStudents.rows,
      bottomStudents:       bottomStudents.rows,
      yearGroupPerformance: yearGroups.rows,
    });
  } catch (error) {
    console.error('School report error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getMyAnalytics, getStudentAnalytics, getSchoolReport };