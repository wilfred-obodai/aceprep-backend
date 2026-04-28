const pool = require('../config/db');

// ══════════════════════════════════════════════
// GET SCHOOL LEADERBOARD
// GET /api/leaderboard/school
// ══════════════════════════════════════════════
const getSchoolLeaderboard = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        s.id,
        s.full_name,
        s.level,
        s.year_group,
        s.class_name,
        COUNT(DISTINCT g.id) as total_assessments,
        ROUND(AVG(g.percentage)::numeric, 1) as average_score,
        COUNT(DISTINCT ss.id) as total_sessions,
        COALESCE(str.current_streak, 0) as current_streak,
        COALESCE(str.total_days, 0) as total_study_days,
        RANK() OVER (ORDER BY AVG(g.percentage) DESC NULLS LAST) as rank
       FROM students s
       LEFT JOIN grades g ON g.student_id = s.id
       LEFT JOIN study_sessions ss ON ss.student_id = s.id
       LEFT JOIN study_streaks str ON str.student_id = s.id
       WHERE s.school_id = $1
       GROUP BY s.id, s.full_name, s.level, s.year_group,
                s.class_name, str.current_streak, str.total_days
       ORDER BY average_score DESC NULLS LAST, total_assessments DESC`,
      [req.schoolId]
    );

    return res.status(200).json({
      success:     true,
      total:       result.rows.length,
      leaderboard: result.rows.map(s => ({
        rank:            parseInt(s.rank),
        studentId:       s.id,
        fullName:        s.full_name,
        level:           s.level,
        yearGroup:       s.year_group,
        className:       s.class_name,
        averageScore:    parseFloat(s.average_score) || 0,
        totalAssessments: parseInt(s.total_assessments),
        totalSessions:   parseInt(s.total_sessions),
        currentStreak:   parseInt(s.current_streak),
        totalStudyDays:  parseInt(s.total_study_days),
        grade: s.average_score >= 80 ? 'A' :
               s.average_score >= 70 ? 'B' :
               s.average_score >= 60 ? 'C' :
               s.average_score >= 50 ? 'D' :
               s.average_score >= 40 ? 'E' : 'F',
      }))
    });

  } catch (error) {
    console.error('Leaderboard error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// GET STUDENT RANK
// GET /api/leaderboard/my-rank
// ══════════════════════════════════════════════
const getMyRank = async (req, res) => {
  try {
    const studentResult = await pool.query(
      'SELECT school_id FROM students WHERE id = $1',
      [req.userId]
    );

    const student = studentResult.rows[0];
    if (!student?.school_id) {
      return res.status(200).json({
        success: true,
        rank:    null,
        message: 'Not linked to a school'
      });
    }

    const result = await pool.query(
      `WITH ranked AS (
        SELECT
          s.id,
          ROUND(AVG(g.percentage)::numeric, 1) as average_score,
          RANK() OVER (ORDER BY AVG(g.percentage) DESC NULLS LAST) as rank,
          COUNT(DISTINCT g.id) as total_assessments
        FROM students s
        LEFT JOIN grades g ON g.student_id = s.id
        WHERE s.school_id = $1
        GROUP BY s.id
      )
      SELECT * FROM ranked WHERE id = $2`,
      [student.school_id, req.userId]
    );

    const totalStudents = await pool.query(
      'SELECT COUNT(*) FROM students WHERE school_id = $1',
      [student.school_id]
    );

    return res.status(200).json({
      success:      true,
      rank:         result.rows[0] ? parseInt(result.rows[0].rank) : null,
      averageScore: result.rows[0] ? parseFloat(result.rows[0].average_score) : 0,
      totalStudents: parseInt(totalStudents.rows[0].count),
      totalAssessments: result.rows[0] ? parseInt(result.rows[0].total_assessments) : 0,
    });

  } catch (error) {
    console.error('My rank error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getSchoolLeaderboard, getMyRank };