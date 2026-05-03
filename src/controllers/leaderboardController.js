const pool = require('../config/db');

// ══════════════════════════════════════════════
// GET SCHOOL LEADERBOARD (Admin)
// GET /api/leaderboard/school
// ══════════════════════════════════════════════
const getSchoolLeaderboard = async (req, res) => {
  try {
    const schoolId = req.schoolId;

    const result = await pool.query(
      `SELECT s.id, s.full_name, s.level, s.year_group, s.class_name,
              COALESCE(AVG(g.percentage), 0) as avg_score,
              COALESCE(x.total_xp, 0) as total_xp,
              COALESCE(st.current_streak, 0) as streak,
              COUNT(g.id) as total_grades
       FROM students s
       LEFT JOIN grades g ON g.student_id = s.id
       LEFT JOIN xp_points x ON x.student_id = s.id
       LEFT JOIN study_streaks st ON st.student_id = s.id
       WHERE s.school_id = $1
       GROUP BY s.id, s.full_name, s.level, s.year_group, s.class_name, x.total_xp, st.current_streak
       ORDER BY avg_score DESC
       LIMIT 50`,
      [schoolId]
    );

    return res.json({
      success: true,
      leaderboard: result.rows.map((r, i) => ({
        rank:        i + 1,
        id:          r.id,
        fullName:    r.full_name,
        level:       r.level,
        yearGroup:   r.year_group,
        className:   r.class_name,
        avgScore:    Math.round(r.avg_score),
        totalXP:     parseInt(r.total_xp),
        streak:      parseInt(r.streak),
        totalGrades: parseInt(r.total_grades),
      }))
    });
  } catch (error) {
    console.error('School leaderboard error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// GET MY RANK (Student)
// GET /api/leaderboard/my-rank
// ══════════════════════════════════════════════
const getMyRank = async (req, res) => {
  try {
    const studentId = req.userId;

    // Get student's school
    const studentRes = await pool.query(
      'SELECT school_id FROM students WHERE id = $1', [studentId]
    );

    if (studentRes.rows.length === 0 || !studentRes.rows[0].school_id) {
      return res.json({ success: true, rank: null, total: 0, leaderboard: [] });
    }

    const schoolId = studentRes.rows[0].school_id;

    // Get full leaderboard
    const result = await pool.query(
      `SELECT s.id, s.full_name, s.level, s.year_group,
              COALESCE(AVG(g.percentage), 0) as avg_score,
              COALESCE(x.total_xp, 0) as total_xp,
              COALESCE(st.current_streak, 0) as streak
       FROM students s
       LEFT JOIN grades g ON g.student_id = s.id
       LEFT JOIN xp_points x ON x.student_id = s.id
       LEFT JOIN study_streaks st ON st.student_id = s.id
       WHERE s.school_id = $1
       GROUP BY s.id, s.full_name, s.level, s.year_group, x.total_xp, st.current_streak
       ORDER BY avg_score DESC`,
      [schoolId]
    );

    const ranked = result.rows.map((r, i) => ({
      rank:      i + 1,
      id:        r.id,
      fullName:  r.full_name,
      level:     r.level,
      yearGroup: r.year_group,
      avgScore:  Math.round(r.avg_score),
      totalXP:   parseInt(r.total_xp),
      streak:    parseInt(r.streak),
      isMe:      r.id === studentId,
    }));

    const myRank = ranked.find(r => r.id === studentId);

    return res.json({
      success:     true,
      rank:        myRank?.rank || null,
      total:       ranked.length,
      leaderboard: ranked.slice(0, 20),
      myStats:     myRank || null,
    });
  } catch (error) {
    console.error('My rank error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// GET NATIONAL LEADERBOARD (Inter-school)
// GET /api/leaderboard/national
// ══════════════════════════════════════════════
const getNationalLeaderboard = async (req, res) => {
  try {
    // School rankings by average student score
    const schoolRankings = await pool.query(
      `SELECT sc.id, sc.name, sc.city, sc.region,
              COUNT(DISTINCT s.id) as student_count,
              COALESCE(AVG(g.percentage), 0) as avg_score,
              COALESCE(SUM(x.total_xp), 0) as total_xp
       FROM schools sc
       LEFT JOIN students s ON s.school_id = sc.id
       LEFT JOIN grades g ON g.student_id = s.id
       LEFT JOIN xp_points x ON x.student_id = s.id
       WHERE sc.is_active = true
       GROUP BY sc.id, sc.name, sc.city, sc.region
       HAVING COUNT(DISTINCT s.id) > 0
       ORDER BY avg_score DESC
       LIMIT 20`
    );

    // Top students nationally
    const topStudents = await pool.query(
      `SELECT s.full_name, s.level,
              sc.name as school_name, sc.city,
              COALESCE(AVG(g.percentage), 0) as avg_score,
              COALESCE(x.total_xp, 0) as total_xp
       FROM students s
       LEFT JOIN schools sc ON s.school_id = sc.id
       LEFT JOIN grades g ON g.student_id = s.id
       LEFT JOIN xp_points x ON x.student_id = s.id
       GROUP BY s.id, s.full_name, s.level, sc.name, sc.city, x.total_xp
       HAVING AVG(g.percentage) IS NOT NULL
       ORDER BY avg_score DESC
       LIMIT 10`
    );

    return res.json({
      success: true,
      schoolRankings: schoolRankings.rows.map((s, i) => ({
        rank:         i + 1,
        id:           s.id,
        name:         s.name,
        city:         s.city,
        region:       s.region,
        studentCount: parseInt(s.student_count),
        avgScore:     Math.round(s.avg_score),
        totalXP:      parseInt(s.total_xp),
      })),
      topStudents: topStudents.rows.map((s, i) => ({
        rank:       i + 1,
        fullName:   s.full_name,
        level:      s.level,
        schoolName: s.school_name,
        city:       s.city,
        avgScore:   Math.round(s.avg_score),
        totalXP:    parseInt(s.total_xp),
      })),
    });
  } catch (error) {
    console.error('National leaderboard error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getSchoolLeaderboard, getMyRank, getNationalLeaderboard };