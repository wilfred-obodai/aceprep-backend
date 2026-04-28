const pool = require('../config/db');

// ══════════════════════════════════════════════
// UPDATE STUDY STREAK
// Called automatically when student logs in
// ══════════════════════════════════════════════
const updateStreak = async (studentId) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const existing = await pool.query(
      'SELECT * FROM study_streaks WHERE student_id = $1',
      [studentId]
    );

    if (existing.rows.length === 0) {
      await pool.query(
        `INSERT INTO study_streaks
          (student_id, current_streak, longest_streak, last_study_date, total_days)
         VALUES ($1, 1, 1, $2, 1)`,
        [studentId, today]
      );
      await checkAndAwardBadges(studentId, 1);
      return;
    }

    const streak     = existing.rows[0];
    const lastDate   = streak.last_study_date
      ? new Date(streak.last_study_date).toISOString().split('T')[0]
      : null;

    if (lastDate === today) return; // Already updated today

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let newStreak = lastDate === yesterdayStr
      ? streak.current_streak + 1
      : 1;

    const newLongest   = Math.max(newStreak, streak.longest_streak);
    const newTotalDays = streak.total_days + 1;

    await pool.query(
      `UPDATE study_streaks
       SET current_streak  = $1,
           longest_streak  = $2,
           last_study_date = $3,
           total_days      = $4,
           updated_at      = NOW()
       WHERE student_id = $5`,
      [newStreak, newLongest, today, newTotalDays, studentId]
    );

    await checkAndAwardBadges(studentId, newStreak, newTotalDays);

  } catch (error) {
    console.error('Update streak error:', error.message);
  }
};

// ── Award badges based on achievements ────────
const checkAndAwardBadges = async (studentId, streak, totalDays = 0) => {
  const badgesToCheck = [
    { type: 'streak_3',   name: '🔥 3-Day Streak',    desc: 'Studied 3 days in a row!',    condition: streak >= 3   },
    { type: 'streak_7',   name: '🔥 7-Day Streak',    desc: 'Studied 7 days in a row!',    condition: streak >= 7   },
    { type: 'streak_14',  name: '🔥 14-Day Streak',   desc: 'Studied 14 days in a row!',   condition: streak >= 14  },
    { type: 'streak_30',  name: '🏆 30-Day Streak',   desc: 'Studied 30 days in a row!',   condition: streak >= 30  },
    { type: 'days_10',    name: '📅 10 Study Days',   desc: 'Studied 10 days total!',      condition: totalDays >= 10  },
    { type: 'days_30',    name: '📅 30 Study Days',   desc: 'Studied 30 days total!',      condition: totalDays >= 30  },
    { type: 'days_100',   name: '💯 100 Study Days',  desc: 'Studied 100 days total!',     condition: totalDays >= 100 },
  ];

  for (const badge of badgesToCheck) {
    if (!badge.condition) continue;
    const exists = await pool.query(
      'SELECT id FROM badges WHERE student_id = $1 AND badge_type = $2',
      [studentId, badge.type]
    );
    if (exists.rows.length === 0) {
      await pool.query(
        `INSERT INTO badges (student_id, badge_type, badge_name, description)
         VALUES ($1, $2, $3, $4)`,
        [studentId, badge.type, badge.name, badge.desc]
      );
    }
  }
};

// ══════════════════════════════════════════════
// GET STUDENT STREAK & BADGES
// GET /api/streaks/mine
// ══════════════════════════════════════════════
const getMyStreak = async (req, res) => {
  try {
    const streakResult = await pool.query(
      'SELECT * FROM study_streaks WHERE student_id = $1',
      [req.userId]
    );

    const badgesResult = await pool.query(
      'SELECT * FROM badges WHERE student_id = $1 ORDER BY earned_at DESC',
      [req.userId]
    );

    const streak = streakResult.rows[0] || {
      current_streak:  0,
      longest_streak:  0,
      total_days:      0,
      last_study_date: null,
    };

    return res.status(200).json({
      success: true,
      streak: {
        currentStreak:  streak.current_streak,
        longestStreak:  streak.longest_streak,
        totalDays:      streak.total_days,
        lastStudyDate:  streak.last_study_date,
      },
      badges: badgesResult.rows.map(b => ({
        id:          b.id,
        type:        b.badge_type,
        name:        b.badge_name,
        description: b.description,
        earnedAt:    b.earned_at,
      }))
    });

  } catch (error) {
    console.error('Get streak error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { updateStreak, getMyStreak };