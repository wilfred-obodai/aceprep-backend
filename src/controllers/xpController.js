const pool = require('../config/db');

const getLevelInfo = (xp) => {
  if (xp >= 5000) return { level: 10, name: '💎 Diamond',    next: null,  color: '#00BCD4' };
  if (xp >= 3000) return { level: 9,  name: '💎 Platinum',   next: 5000,  color: '#9C27B0' };
  if (xp >= 2000) return { level: 8,  name: '🥇 Gold III',   next: 3000,  color: '#FFD700' };
  if (xp >= 1500) return { level: 7,  name: '🥇 Gold II',    next: 2000,  color: '#FFC107' };
  if (xp >= 1000) return { level: 6,  name: '🥇 Gold I',     next: 1500,  color: '#FF9800' };
  if (xp >= 700)  return { level: 5,  name: '🥈 Silver III', next: 1000,  color: '#9E9E9E' };
  if (xp >= 400)  return { level: 4,  name: '🥈 Silver II',  next: 700,   color: '#78909C' };
  if (xp >= 200)  return { level: 3,  name: '🥈 Silver I',   next: 400,   color: '#607D8B' };
  if (xp >= 100)  return { level: 2,  name: '🥉 Bronze II',  next: 200,   color: '#A1887F' };
  return           { level: 1,  name: '🥉 Bronze I',   next: 100,   color: '#8D6E63' };
};

// ══════════════════════════════════════════════
// ADD XP
// ══════════════════════════════════════════════
const addXP = async (studentId, amount, reason) => {
  try {
    await pool.query(
      `INSERT INTO xp_points (student_id, total_xp, weekly_xp)
       VALUES ($1, $2, $2)
       ON CONFLICT (student_id)
       DO UPDATE SET
         total_xp  = xp_points.total_xp + $2,
         weekly_xp = xp_points.weekly_xp + $2,
         updated_at = NOW()`,
      [studentId, amount]
    );

    if (reason) {
      await pool.query(
        `INSERT INTO xp_transactions (student_id, amount, reason) VALUES ($1, $2, $3)`,
        [studentId, amount, reason]
      ).catch(() => {}); // ignore if table doesn't exist
    }
  } catch (error) {
    console.error('Add XP error:', error.message);
  }
};

// ══════════════════════════════════════════════
// GET MY XP
// GET /api/xp/mine
// ══════════════════════════════════════════════
const getMyXP = async (req, res) => {
  try {
    const studentId = req.userId;

    // Get or create XP record
    let xpResult = await pool.query(
      'SELECT * FROM xp_points WHERE student_id = $1', [studentId]
    );

    if (xpResult.rows.length === 0) {
      await pool.query(
        `INSERT INTO xp_points (student_id, total_xp, weekly_xp)
         VALUES ($1, 0, 0) ON CONFLICT DO NOTHING`,
        [studentId]
      );
      xpResult = await pool.query(
        'SELECT * FROM xp_points WHERE student_id = $1', [studentId]
      );
    }

    const xpData    = xpResult.rows[0] || { total_xp: 0, weekly_xp: 0 };
    const totalXP   = parseInt(xpData.total_xp || 0);
    const weeklyXP  = parseInt(xpData.weekly_xp || 0);
    const levelInfo = getLevelInfo(totalXP);

    // Get study sessions this week
    const sessionsResult = await pool.query(
      `SELECT COUNT(*) as count FROM study_sessions
       WHERE student_id = $1
       AND login_at >= NOW() - INTERVAL '7 days'`,
      [studentId]
    );

    const sessionsThisWeek = parseInt(sessionsResult.rows[0]?.count || 0);

    // Weekly challenges
    const challenges = [
      {
        id:       'daily_grind',
        name:     'Daily Grind',
        desc:     'Study for 5 days in a row',
        xp:       300,
        progress: Math.min(sessionsThisWeek, 5),
        target:   5,
        done:     sessionsThisWeek >= 5,
      },
      {
        id:       'perfect_score',
        name:     'Perfect Score',
        desc:     'Score 90%+ on any exam',
        xp:       200,
        progress: 0,
        target:   1,
        done:     false,
      },
      {
        id:       'question_master',
        name:     'Question Master',
        desc:     'Answer 20 past questions',
        xp:       150,
        progress: 0,
        target:   20,
        done:     false,
      },
    ];

    // How to earn XP list
    const howToEarn = [
      { action: 'Start a study session',    xp: '+5 XP' },
      { action: 'Complete an exam',         xp: '+20 XP' },
      { action: 'Score 80%+ on an exam',    xp: '+60 XP' },
      { action: 'Submit an assignment',     xp: '+10 XP' },
      { action: 'Answer past questions',    xp: '+2 XP' },
      { action: 'Complete a challenge',     xp: '+50-300 XP' },
      { action: 'Win a quiz battle',        xp: '+100 XP' },
      { action: '7-day study streak',       xp: '+70 XP' },
    ];

    return res.json({
      success: true,
      xp: {
        total:      totalXP,
        weekly:     weeklyXP,
        level:      levelInfo.level,
        levelName:  levelInfo.name,
        levelColor: levelInfo.color,
        nextLevel:  levelInfo.next,
        progress:   levelInfo.next
          ? Math.round((totalXP / levelInfo.next) * 100)
          : 100,
      },
      challenges,
      howToEarn,
      sessionsThisWeek,
    });

  } catch (error) {
    console.error('Get XP error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// GET XP LEADERBOARD
// GET /api/xp/school-leaderboard
// ══════════════════════════════════════════════
const getXPLeaderboard = async (req, res) => {
  try {
    const schoolId = req.schoolId;

    const result = await pool.query(
      `SELECT s.id, s.full_name, s.level, s.year_group,
              COALESCE(x.total_xp, 0) as total_xp,
              COALESCE(x.weekly_xp, 0) as weekly_xp
       FROM students s
       LEFT JOIN xp_points x ON x.student_id = s.id
       WHERE s.school_id = $1
       ORDER BY total_xp DESC
       LIMIT 50`,
      [schoolId]
    );

    return res.json({
      success:     true,
      leaderboard: result.rows.map((r, i) => ({
        rank:      i + 1,
        id:        r.id,
        fullName:  r.full_name,
        level:     r.level,
        yearGroup: r.year_group,
        totalXP:   parseInt(r.total_xp),
        weeklyXP:  parseInt(r.weekly_xp),
        levelInfo: getLevelInfo(parseInt(r.total_xp)),
      }))
    });
  } catch (error) {
    console.error('XP leaderboard error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// AWARD XP ON SESSION START
// POST /api/xp/session
// ══════════════════════════════════════════════
const awardSessionXP = async (req, res) => {
  try {
    const studentId = req.userId;
    await addXP(studentId, 5, 'Study session started');
    return res.json({ success: true, xpAwarded: 5 });
  } catch (error) {
    console.error('Award session XP error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getMyXP, getXPLeaderboard, addXP, awardSessionXP };