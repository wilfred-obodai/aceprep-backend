const pool = require('../config/db');

// ══════════════════════════════════════════════
// VALIDATE SCHOOL CODE
// GET /api/schools/validate-code/:code
// ══════════════════════════════════════════════
const validateSchoolCode = async (req, res) => {
  const { code } = req.params;

  if (!code) {
    return res.status(400).json({
      success: false,
      message: 'School code is required'
    });
  }

  try {
    const result = await pool.query(
      `SELECT id, name, city, region, motto, logo_url, is_active
       FROM schools 
       WHERE code = $1`,
      [code.toUpperCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'School code not found. Please check with your school admin.'
      });
    }

    const school = result.rows[0];

    if (!school.is_active) {
      return res.status(403).json({
        success: false,
        message: 'This school license has expired. Please contact your school.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'School code verified!',
      school: {
        name:    school.name,
        city:    school.city,
        region:  school.region,
        motto:   school.motto,
        logoUrl: school.logo_url,
      }
    });

  } catch (error) {
    console.error('Validate school code error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error — please try again'
    });
  }
};

// ══════════════════════════════════════════════
// GET SCHOOL PROFILE
// GET /api/schools/profile
// ══════════════════════════════════════════════
const getSchoolProfile = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.id, s.name, s.code, s.city, s.region, s.email,
              s.phone, s.motto, s.address, s.logo_url, s.is_active,
              s.license_expires_at, s.created_at,
              COUNT(DISTINCT st.id) as total_students,
              COUNT(DISTINCT t.id)  as total_teachers
       FROM schools s
       LEFT JOIN students st ON st.school_id = s.id
       LEFT JOIN teachers t  ON t.school_id  = s.id
       WHERE s.id = $1
       GROUP BY s.id`,
      [req.schoolId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'School not found'
      });
    }

    const school = result.rows[0];

    return res.status(200).json({
      success: true,
      school: {
        id:               school.id,
        name:             school.name,
        code:             school.code,
        city:             school.city,
        region:           school.region,
        email:            school.email,
        phone:            school.phone,
        motto:            school.motto,
        address:          school.address,
        logoUrl:          school.logo_url,
        isActive:         school.is_active,
        licenseExpiresAt: school.license_expires_at,
        totalStudents:    parseInt(school.total_students),
        totalTeachers:    parseInt(school.total_teachers),
        createdAt:        school.created_at,
      }
    });

  } catch (error) {
    console.error('Get school profile error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error — please try again'
    });
  }
};

// ══════════════════════════════════════════════
// GET ALL STUDENTS IN SCHOOL
// GET /api/schools/students
// ══════════════════════════════════════════════
const getSchoolStudents = async (req, res) => {
  const { yearGroup, className, level } = req.query;

  try {
    let query = `
      SELECT id, full_name, email, level, year_group,
             class_name, shs_track, student_type,
             is_active, created_at
      FROM students
      WHERE school_id = $1
    `;
    const params = [req.schoolId];

    if (yearGroup) {
      params.push(yearGroup);
      query += ` AND year_group = $${params.length}`;
    }
    if (className) {
      params.push(className);
      query += ` AND class_name = $${params.length}`;
    }
    if (level) {
      params.push(level.toUpperCase());
      query += ` AND level = $${params.length}`;
    }

    query += ` ORDER BY year_group, class_name, full_name`;

    const result = await pool.query(query, params);

    return res.status(200).json({
      success:  true,
      total:    result.rows.length,
      students: result.rows.map(s => ({
        id:          s.id,
        fullName:    s.full_name,
        email:       s.email,
        level:       s.level,
        yearGroup:   s.year_group,
        className:   s.class_name,
        shsTrack:    s.shs_track,
        studentType: s.student_type,
        isActive:    s.is_active,
        joinedAt:    s.created_at,
      }))
    });

  } catch (error) {
    console.error('Get school students error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error — please try again'
    });
  }
};

// ══════════════════════════════════════════════
// GET SCHOOL MONITORING DATA
// GET /api/schools/monitoring
// ══════════════════════════════════════════════
const getSchoolMonitoring = async (req, res) => {
  const { yearGroup, className, level } = req.query;

  try {
    let query = `
      SELECT 
        s.id, s.full_name, s.email, s.level, 
        s.year_group, s.class_name, s.shs_track,
        MAX(ss.login_at) as last_login,
        BOOL_OR(ss.logout_at IS NULL) as is_active_now,
        COALESCE(SUM(ss.duration_minutes) FILTER (
          WHERE ss.login_at >= NOW() - INTERVAL '7 days'
        ), 0) as study_minutes_this_week,
        COALESCE(SUM(ss.duration_minutes) FILTER (
          WHERE DATE(ss.login_at) = CURRENT_DATE
        ), 0) as study_minutes_today,
        COUNT(DISTINCT ss.id) as total_sessions,
        COUNT(DISTINCT DATE(ss.login_at)) FILTER (
          WHERE ss.login_at >= NOW() - INTERVAL '30 days'
        ) as study_days_this_month
      FROM students s
      LEFT JOIN study_sessions ss ON ss.student_id = s.id
      WHERE s.school_id = $1
    `;

    const params = [req.schoolId];

    if (yearGroup) {
      params.push(yearGroup);
      query += ` AND s.year_group = $${params.length}`;
    }
    if (className) {
      params.push(className);
      query += ` AND s.class_name = $${params.length}`;
    }
    if (level) {
      params.push(level.toUpperCase());
      query += ` AND s.level = $${params.length}`;
    }

    query += `
      GROUP BY s.id
      ORDER BY last_login DESC NULLS LAST
    `;

    const result = await pool.query(query, params);

    const totalStudents = result.rows.length;
    const activeNow     = result.rows.filter(s => s.is_active_now).length;
    const studiedToday  = result.rows.filter(s => s.study_minutes_today > 0).length;
    const neverLoggedIn = result.rows.filter(s => !s.last_login).length;

    return res.status(200).json({
      success: true,
      summary: {
        totalStudents,
        activeNow,
        studiedToday,
        neverLoggedIn,
        notStudiedToday: totalStudents - studiedToday,
      },
      students: result.rows.map(s => ({
        id:                   s.id,
        fullName:             s.full_name,
        email:                s.email,
        level:                s.level,
        yearGroup:            s.year_group,
        className:            s.class_name,
        shsTrack:             s.shs_track,
        lastLogin:            s.last_login,
        isActiveNow:          s.is_active_now,
        studyMinutesToday:    parseInt(s.study_minutes_today),
        studyMinutesThisWeek: parseInt(s.study_minutes_this_week),
        totalSessions:        parseInt(s.total_sessions),
        studyDaysThisMonth:   parseInt(s.study_days_this_month),
      }))
    });

  } catch (error) {
    console.error('Get monitoring error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error — please try again'
    });
  }
};

// ══════════════════════════════════════════════
// GET SCHOOL TEACHERS
// GET /api/schools/teachers
// ══════════════════════════════════════════════
const getSchoolTeachers = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, full_name, email, role, subjects, phone, is_active, created_at
       FROM teachers
       WHERE school_id = $1
       ORDER BY role DESC, full_name ASC`,
      [req.schoolId]
    );

    return res.status(200).json({
      success:  true,
      total:    result.rows.length,
      teachers: result.rows.map(t => ({
        id:        t.id,
        fullName:  t.full_name,
        email:     t.email,
        role:      t.role,
        subjects:  t.subjects,
        phone:     t.phone,
        isActive:  t.is_active,
        joinedAt:  t.created_at,
      }))
    });
  } catch (error) {
    console.error('Get teachers error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  validateSchoolCode,
  getSchoolProfile,
  getSchoolStudents,
  getSchoolMonitoring,
  getSchoolTeachers,
};