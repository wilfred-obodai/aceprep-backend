const pool = require('../config/db');

// ══════════════════════════════════════════════
// GET STUDENT SELF ANALYTICS
// GET /api/analytics/mine
// ══════════════════════════════════════════════
const getMyAnalytics = async (req, res) => {
  const studentId = req.params.studentId || req.userId;

  try {
    // Get all grades
    const gradesResult = await pool.query(
      `SELECT subject, assessment_type, percentage, grade_letter, created_at
       FROM grades
       WHERE student_id = $1
       ORDER BY created_at ASC`,
      [studentId]
    );

    const grades = gradesResult.rows;

    // Group by subject
    const subjectMap = grades.reduce((acc, g) => {
      if (!acc[g.subject]) acc[g.subject] = [];
      acc[g.subject].push(parseFloat(g.percentage));
      return acc;
    }, {});

    // Subject averages
    const subjectAverages = Object.entries(subjectMap).map(([subject, scores]) => ({
      subject,
      average:    parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)),
      count:      scores.length,
      highest:    Math.max(...scores),
      lowest:     Math.min(...scores),
      grade:      scores.reduce((a,b) => a+b,0)/scores.length >= 80 ? 'A' :
                  scores.reduce((a,b) => a+b,0)/scores.length >= 70 ? 'B' :
                  scores.reduce((a,b) => a+b,0)/scores.length >= 60 ? 'C' :
                  scores.reduce((a,b) => a+b,0)/scores.length >= 50 ? 'D' : 'F',
    })).sort((a, b) => a.average - b.average);

    // Weak subjects (below 60%)
    const weakSubjects  = subjectAverages.filter(s => s.average < 60);
    const strongSubjects = subjectAverages.filter(s => s.average >= 70);

    // Overall stats
    const allScores  = grades.map(g => parseFloat(g.percentage));
    const overallAvg = allScores.length > 0
      ? parseFloat((allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1))
      : 0;

    // Performance trend (last 10 assessments)
    const trend = grades.slice(-10).map(g => ({
      subject:    g.subject,
      percentage: parseFloat(g.percentage),
      date:       g.created_at,
    }));

    // Study sessions
    const sessionsResult = await pool.query(
      `SELECT DATE(login_at) as date,
              SUM(duration_minutes) as total_minutes,
              COUNT(*) as session_count
       FROM study_sessions
       WHERE student_id = $1
         AND login_at >= NOW() - INTERVAL '30 days'
       GROUP BY DATE(login_at)
       ORDER BY date ASC`,
      [studentId]
    );

    const totalStudyMins = sessionsResult.rows.reduce(
      (sum, r) => sum + parseInt(r.total_minutes || 0), 0
    );

    // AI Recommendations
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

module.exports = { getMyAnalytics, getStudentAnalytics };