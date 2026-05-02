const pool = require('../config/db');

// ── XP Level Calculator ────────────────────────
const getLevelInfo = (xp) => {
  if (xp >= 5000) return { level: 10, name: '💎 Diamond',   next: null,  color: '#00BCD4' };
  if (xp >= 3000) return { level: 9,  name: '💎 Platinum',  next: 5000,  color: '#9C27B0' };
  if (xp >= 2000) return { level: 8,  name: '🥇 Gold III',  next: 3000,  color: '#FFD700' };
  if (xp >= 1500) return { level: 7,  name: '🥇 Gold II',   next: 2000,  color: '#FFC107' };
  if (xp >= 1000) return { level: 6,  name: '🥇 Gold I',    next: 1500,  color: '#FF9800' };
  if (xp >= 700)  return { level: 5,  name: '🥈 Silver III',next: 1000,  color: '#9E9E9E' };
  if (xp >= 400)  return { level: 4,  name: '🥈 Silver II', next: 700,   color: '#78909C' };
  if (xp >= 200)  return { level: 3,  name: '🥈 Silver I',  next: 400,   color: '#607D8B' };
  if (xp >= 100)  return { level: 2,  name: '🥉 Bronze II', next: 200,   color: '#A1887F' };
  return           { level: 1,  name: '🥉 Bronze I',  next: 100,   color: '#8D6E63' };
};

// ══════════════════════════════════════════════
// AWARD XP TO STUDENT
// ══════════════════════════════════════════════
const awardXP = async (studentId, points, reason) => {
  try {
    const existing = await pool.query(
      'SELECT * FROM student_xp WHERE student_id = $1',
      [studentId]
    );

    if (existing.rows.length === 0) {
      const levelInfo = getLevelInfo(points);
      await pool.query(
        `INSERT INTO student_xp (student_id, xp_points, weekly_xp, level, level_name)
         VALUES ($1, $2, $2, $3, $4)`,
        [studentId, points, levelInfo.level, levelInfo.name]
      );
    } else {
      const newXP      = existing.rows[0].xp_points + points;
      const newWeekly  = existing.rows[0].weekly_xp + points;
      const levelInfo  = getLevelInfo(newXP);
      await pool.query(
        `UPDATE student_xp
         SET xp_points  = $1,
             weekly_xp  = $2,
             level      = $3,
             level_name = $4,
             updated_at = NOW()
         WHERE student_id = $5`,
        [newXP, newWeekly, levelInfo.level, levelInfo.name, studentId]
      );
    }
  } catch (error) {
    console.error('Award XP error:', error.message);
  }
};

// ══════════════════════════════════════════════
// GET MY XP & LEVEL
// GET /api/xp/mine
// ══════════════════════════════════════════════
const getMyXP = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM student_xp WHERE student_id = $1',
      [req.userId]
    );

    const xpData    = result.rows[0] || { xp_points: 0, weekly_xp: 0, level: 1, level_name: '🥉 Bronze I' };
    const levelInfo = getLevelInfo(xpData.xp_points);
    const progress  = levelInfo.next
      ? Math.round(((xpData.xp_points - (levelInfo.next - 100)) / 100) * 100)
      : 100;

    // Get challenges
    const challengesResult = await pool.query(
      `SELECT c.*, cp.progress as my_progress, cp.completed
       FROM challenges c
       LEFT JOIN challenge_progress cp
         ON cp.challenge_id = c.id AND cp.student_id = $1
       WHERE c.is_active = true
       ORDER BY c.xp_reward DESC`,
      [req.userId]
    );

    return res.status(200).json({
      success: true,
      xp: {
        total:      xpData.xp_points,
        weekly:     xpData.weekly_xp,
        level:      levelInfo.level,
        levelName:  levelInfo.name,
        levelColor: levelInfo.color,
        nextLevel:  levelInfo.next,
        progress:   Math.min(100, Math.max(0, progress)),
      },
      challenges: challengesResult.rows.map(c => ({
        id:          c.id,
        title:       c.title,
        description: c.description,
        xpReward:    c.xp_reward,
        type:        c.challenge_type,
        target:      c.target_count,
        myProgress:  c.my_progress || 0,
        completed:   c.completed || false,
      }))
    });

  } catch (error) {
    console.error('Get XP error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// GET SCHOOL XP LEADERBOARD
// GET /api/xp/school-leaderboard
// ══════════════════════════════════════════════
const getXPLeaderboard = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.id, s.full_name, s.level as student_level,
              s.year_group, s.class_name,
              COALESCE(x.xp_points, 0) as xp_points,
              COALESCE(x.level, 1) as xp_level,
              COALESCE(x.level_name, '🥉 Bronze I') as level_name,
              COALESCE(x.weekly_xp, 0) as weekly_xp,
              RANK() OVER (ORDER BY COALESCE(x.xp_points, 0) DESC) as rank
       FROM students s
       LEFT JOIN student_xp x ON x.student_id = s.id
       WHERE s.school_id = $1
       ORDER BY xp_points DESC`,
      [req.schoolId]
    );

    return res.status(200).json({
      success:     true,
      leaderboard: result.rows.map(s => ({
        rank:      parseInt(s.rank),
        studentId: s.id,
        fullName:  s.full_name,
        level:     s.student_level,
        yearGroup: s.year_group,
        className: s.class_name,
        xpPoints:  parseInt(s.xp_points),
        xpLevel:   s.xp_level,
        levelName: s.level_name,
        weeklyXP:  parseInt(s.weekly_xp),
      }))
    });

  } catch (error) {
    console.error('XP leaderboard error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { awardXP, getMyXP, getXPLeaderboard, getLevelInfo };