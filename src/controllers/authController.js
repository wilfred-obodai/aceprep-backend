const bcrypt       = require('bcryptjs');
const jwt          = require('jsonwebtoken');
const crypto       = require('crypto');
const pool         = require('../config/db');
const {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendSchoolVerificationEmail,
  sendSchoolWelcomeEmail
} = require('../config/email');
require('dotenv').config();

// ── Helper: Generate JWT Token ─────────────────
const generateToken = (id, role) => {
  return jwt.sign(
    { id, role },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
};

// ── Helper: Generate verification token ────────
const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

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
// REGISTER SCHOOL
// POST /api/auth/register/school
// ══════════════════════════════════════════════
const registerSchool = async (req, res) => {
  const {
    name, email, password, city,
    region, phone, motto, address
  } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      message: 'School name, email and password are required'
    });
  }

  try {
    // Check if email already exists
    const existing = await pool.query(
      'SELECT id FROM teachers WHERE email = $1',
      [email]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'A school with this email already exists'
      });
    }

    // Generate unique school code
    const randomNum  = crypto.randomInt(10000, 100000);
    const schoolCode = `ACP-${randomNum}`;

    // Insert school
    const schoolResult = await pool.query(
      `INSERT INTO schools
        (name, code, city, region, email, phone, motto, address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, code, city, region, email`,
      [name, schoolCode, city, region, email, phone, motto, address]
    );
    const school = schoolResult.rows[0];

    // Hash password
    const hashedPassword    = await bcrypt.hash(password, 12);
    const verificationToken = generateVerificationToken();

    // Create admin teacher account
    const teacherResult = await pool.query(
      `INSERT INTO teachers
        (school_id, full_name, email, password, role, verification_token)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, full_name, email, role`,
      [school.id, `${name} Admin`, email, hashedPassword, 'admin', verificationToken]
    );
    const teacher = teacherResult.rows[0];

    // Send school-specific verification email
    await sendSchoolVerificationEmail(email, name, verificationToken);

    return res.status(201).json({
      success: true,
      message: 'School registered! Please check your email to verify your account.',
      school: {
        id:     school.id,
        name:   school.name,
        code:   school.code,
        city:   school.city,
        region: school.region,
        email:  school.email,
      }
    });

  } catch (error) {
    console.error('Register school error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error — please try again'
    });
  }
};

// ══════════════════════════════════════════════
// REGISTER STUDENT
// POST /api/auth/register/student
// ══════════════════════════════════════════════
const registerStudent = async (req, res) => {
  const {
    fullName, email, password,
    dateOfBirth, gender, level,
    yearGroup, className, shsTrack,
    schoolCode
  } = req.body;

  if (!fullName || !email || !password || !level || !yearGroup) {
    return res.status(400).json({
      success: false,
      message: 'Full name, email, password, level and year group are required'
    });
  }

  try {
    // Check if email already exists
    const existing = await pool.query(
      'SELECT id FROM students WHERE email = $1',
      [email]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists'
      });
    }

    let schoolId    = null;
    let studentType = 'independent';

    // Validate school code if provided
    if (schoolCode) {
      const schoolResult = await pool.query(
        'SELECT id, name, is_active FROM schools WHERE code = $1',
        [schoolCode.toUpperCase()]
      );

      if (schoolResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'School code not found. Please check with your school admin.'
        });
      }

      if (!schoolResult.rows[0].is_active) {
        return res.status(403).json({
          success: false,
          message: 'This school license has expired. Please contact your school.'
        });
      }

      schoolId    = schoolResult.rows[0].id;
      studentType = 'school-linked';
    }

    // Hash password and generate verification token
    const hashedPassword    = await bcrypt.hash(password, 12);
    const verificationToken = generateVerificationToken();

    // Insert student
    const studentResult = await pool.query(
      `INSERT INTO students
        (school_id, full_name, email, password, date_of_birth,
         gender, level, year_group, class_name, shs_track,
         student_type, verification_token)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, full_name, email, level, year_group,
                 class_name, student_type, school_id`,
      [
        schoolId, fullName, email, hashedPassword,
        dateOfBirth, gender, level, yearGroup,
        className, shsTrack, studentType, verificationToken
      ]
    );
    const student = studentResult.rows[0];

    // Send student-specific verification email
    await sendVerificationEmail(email, fullName, verificationToken);

    return res.status(201).json({
      success: true,
      message: 'Account created! Please check your email to verify your account.',
      student: {
        id:          student.id,
        fullName:    student.full_name,
        email:       student.email,
        level:       student.level,
        yearGroup:   student.year_group,
        studentType: student.student_type,
      }
    });

  } catch (error) {
    console.error('Register student error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error — please try again'
    });
  }
};

// ══════════════════════════════════════════════
// VERIFY EMAIL
// GET /api/auth/verify-email?token=xxx
// ══════════════════════════════════════════════
const verifyEmail = async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({
      success: false,
      message: 'Verification token is required'
    });
  }

  try {
    // Check students table first
    const studentResult = await pool.query(
      `UPDATE students
       SET is_verified = true, verification_token = null
       WHERE verification_token = $1
       RETURNING id, full_name, email`,
      [token]
    );

    if (studentResult.rows.length > 0) {
      const student = studentResult.rows[0];
      // Student welcome email
      await sendWelcomeEmail(student.email, student.full_name);
      return res.status(200).json({
        success: true,
        message: 'Email verified! You can now login to AcePrep. 🎉',
        type:    'student'
      });
    }

    // Check teachers table
    const teacherResult = await pool.query(
      `UPDATE teachers
       SET is_verified = true, verification_token = null
       WHERE verification_token = $1
       RETURNING id, full_name, email, role,
         (SELECT name FROM schools WHERE id = teachers.school_id) as school_name`,
      [token]
    );

    if (teacherResult.rows.length > 0) {
      const teacher = teacherResult.rows[0];
      // School admin welcome email
      await sendSchoolWelcomeEmail(teacher.email, teacher.school_name || teacher.full_name);
      return res.status(200).json({
        success: true,
        message: 'School account verified! You can now login to the AcePrep School Dashboard. 🏫',
        type:    'school'
      });
    }

    // Token not found
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired verification token'
    });

  } catch (error) {
    console.error('Verify email error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error — please try again'
    });
  }
};

// ══════════════════════════════════════════════
// LOGIN
// POST /api/auth/login
// ══════════════════════════════════════════════
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required'
    });
  }

  try {
    let user     = null;
    let userRole = 'student';

    // Check students table first
    const studentResult = await pool.query(
      `SELECT s.*, sc.name as school_name, sc.code as school_code
       FROM students s
       LEFT JOIN schools sc ON s.school_id = sc.id
       WHERE s.email = $1`,
      [email]
    );

    if (studentResult.rows.length > 0) {
      user     = studentResult.rows[0];
      userRole = 'student';
    } else {
      // Check teachers table
      const teacherResult = await pool.query(
        `SELECT t.*, sc.name as school_name, sc.code as school_code
         FROM teachers t
         LEFT JOIN schools sc ON t.school_id = sc.id
         WHERE t.email = $1`,
        [email]
      );
      if (teacherResult.rows.length > 0) {
        user     = teacherResult.rows[0];
        userRole = user.role;
      }
    }

    // User not found
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if email is verified
    if (!user.is_verified) {
      return res.status(401).json({
        success: false,
        message: 'Please verify your email before logging in. Check your inbox.'
      });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate token
    const token = generateToken(user.id, userRole);

    return res.status(200).json({
      success: true,
      message: 'Login successful!',
      token,
      user: {
        id:          user.id,
        fullName:    user.full_name,
        email:       user.email,
        role:        userRole,
        schoolName:  user.school_name  || null,
        schoolCode:  user.school_code  || null,
        level:       user.level        || null,
        yearGroup:   user.year_group   || null,
        studentType: user.student_type || null,
      }
    });

  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error — please try again'
    });
  }
};

// ══════════════════════════════════════════════
// REGISTER TEACHER (Admin only)
// POST /api/auth/register/teacher
// ══════════════════════════════════════════════
const registerTeacher = async (req, res) => {
  const { fullName, email, password, subjects, phone } = req.body;

  if (!fullName || !email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Full name, email and password are required'
    });
  }

  try {
    // Check if email exists
    const existing = await pool.query(
      'SELECT id FROM teachers WHERE email = $1',
      [email]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'A teacher with this email already exists'
      });
    }

    const hashedPassword    = await bcrypt.hash(password, 12);
    const verificationToken = generateVerificationToken();

    const result = await pool.query(
      `INSERT INTO teachers
        (school_id, full_name, email, password, role,
         subjects, phone, verification_token, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, full_name, email, role`,
      [
        req.schoolId, fullName, email, hashedPassword,
        'teacher', subjects || [], phone || null,
        verificationToken, true
      ]
    );

    const teacher = result.rows[0];

    // Send teacher welcome email
    await sendSchoolWelcomeEmail(email, fullName);

    return res.status(201).json({
      success: true,
      message: 'Teacher account created successfully!',
      teacher: {
        id:       teacher.id,
        fullName: teacher.full_name,
        email:    teacher.email,
        role:     teacher.role,
      }
    });

  } catch (error) {
    console.error('Register teacher error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error — please try again'
    });
  }
};

// ══════════════════════════════════════════════
// FORGOT PASSWORD
// POST /api/auth/forgot-password
// ══════════════════════════════════════════════
const forgotPassword = async (req, res) => {
  const { email, role } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

  try {
    const resetToken  = generateVerificationToken();
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    let found = false;

    if (role === 'student' || !role) {
      const result = await pool.query(
        'UPDATE students SET reset_token = $1, reset_token_expiry = $2 WHERE email = $3 RETURNING email, full_name',
        [resetToken, resetExpiry, email]
      );
      if (result.rows.length > 0) {
        found = true;
        const resetUrl = `http://localhost:3001/reset-password?token=${resetToken}&role=student`;
        await sendVerificationEmail(email, result.rows[0].full_name, resetToken, true, resetUrl);
      }
    }

    if (!found && (role === 'admin' || role === 'teacher' || !role)) {
      const result = await pool.query(
        'UPDATE teachers SET reset_token = $1, reset_token_expiry = $2 WHERE email = $3 RETURNING email, full_name',
        [resetToken, resetExpiry, email]
      );
      if (result.rows.length > 0) {
        found = true;
        const resetUrl = `http://localhost:3001/reset-password?token=${resetToken}&role=admin`;
        await sendSchoolVerificationEmail(email, result.rows[0].full_name, resetToken, true, resetUrl);
      }
    }

    if (!found && (role === 'parent' || !role)) {
      const result = await pool.query(
        'UPDATE parents SET reset_token = $1, reset_token_expiry = $2 WHERE email = $3 RETURNING email, full_name',
        [resetToken, resetExpiry, email]
      );
      if (result.rows.length > 0) {
        found = true;
        const resetUrl = `http://localhost:3001/reset-password?token=${resetToken}&role=parent`;
        await sendVerificationEmail(email, result.rows[0].full_name, resetToken, true, resetUrl);
      }
    }

    // Always return success for security (don't reveal if email exists)
    return res.json({
      success: true,
      message: 'If an account with that email exists, a reset link has been sent.'
    });

  } catch (error) {
    console.error('Forgot password error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// RESET PASSWORD
// POST /api/auth/reset-password
// ══════════════════════════════════════════════
const resetPassword = async (req, res) => {
  const { token, password, role } = req.body;
  if (!token || !password) return res.status(400).json({ success: false, message: 'Token and password are required' });

  try {
    const hashedPassword = await bcrypt.hash(password, 12);
    let updated = false;

    if (role === 'student') {
      const result = await pool.query(
        `UPDATE students SET password = $1, reset_token = NULL, reset_token_expiry = NULL
         WHERE reset_token = $2 AND reset_token_expiry > NOW() RETURNING id`,
        [hashedPassword, token]
      );
      updated = result.rows.length > 0;
    } else if (role === 'admin') {
      const result = await pool.query(
        `UPDATE teachers SET password = $1, reset_token = NULL, reset_token_expiry = NULL
         WHERE reset_token = $2 AND reset_token_expiry > NOW() RETURNING id`,
        [hashedPassword, token]
      );
      updated = result.rows.length > 0;
    } else if (role === 'parent') {
      const result = await pool.query(
        `UPDATE parents SET password = $1, reset_token = NULL, reset_token_expiry = NULL
         WHERE reset_token = $2 AND reset_token_expiry > NOW() RETURNING id`,
        [hashedPassword, token]
      );
      updated = result.rows.length > 0;
    }

    if (!updated) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }

    return res.json({ success: true, message: 'Password reset successfully! You can now login.' });

  } catch (error) {
    console.error('Reset password error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// STUDENT LOGIN (dedicated)
// POST /api/auth/student/login
// ══════════════════════════════════════════════
const loginStudent = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required' });

  try {
    const result = await pool.query(
      `SELECT s.*, sc.name as school_name, sc.code as school_code
       FROM students s LEFT JOIN schools sc ON s.school_id = sc.id
       WHERE s.email = $1`, [email]
    );

    if (result.rows.length === 0) return res.status(401).json({ success: false, message: 'Invalid email or password' });

    const student = result.rows[0];
    if (!student.is_verified) return res.status(401).json({ success: false, message: 'Please verify your email before logging in.' });

    const isMatch = await bcrypt.compare(password, student.password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid email or password' });

    const token = generateToken(student.id, 'student');

    // Update last login
    await pool.query('UPDATE students SET last_login = NOW() WHERE id = $1', [student.id]);

    return res.json({
      success: true,
      message: 'Login successful!',
      token,
      user: {
        id:          student.id,
        fullName:    student.full_name,
        email:       student.email,
        role:        'student',
        schoolName:  student.school_name  || null,
        schoolCode:  student.school_code  || null,
        level:       student.level        || null,
        yearGroup:   student.year_group   || null,
        className:   student.class_name   || null,
        studentType: student.student_type || null,
      }
    });
  } catch (error) {
    console.error('Student login error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// SCHOOL ADMIN LOGIN (dedicated)
// POST /api/auth/school/login
// ══════════════════════════════════════════════
const loginSchool = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required' });

  try {
    const result = await pool.query(
      `SELECT t.*, sc.name as school_name, sc.code as school_code,
              sc.logo_url, sc.city, sc.region
       FROM teachers t LEFT JOIN schools sc ON t.school_id = sc.id
       WHERE t.email = $1`, [email]
    );

    if (result.rows.length === 0) return res.status(401).json({ success: false, message: 'Invalid email or password' });

    const teacher = result.rows[0];
    if (!teacher.is_verified) return res.status(401).json({ success: false, message: 'Please verify your email before logging in.' });

    const isMatch = await bcrypt.compare(password, teacher.password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid email or password' });

    const token = generateToken(teacher.id, teacher.role);

    return res.json({
      success: true,
      message: 'Login successful!',
      token,
      user: {
        id:       teacher.id,
        fullName: teacher.full_name,
        email:    teacher.email,
        role:     teacher.role,
      },
      school: {
        id:       teacher.school_id,
        name:     teacher.school_name,
        code:     teacher.school_code,
        logoUrl:  teacher.logo_url,
        city:     teacher.city,
        region:   teacher.region,
      }
    });
  } catch (error) {
    console.error('School login error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// PARENT LOGIN
// POST /api/auth/parent/login
// ══════════════════════════════════════════════
const loginParent = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required' });

  try {
    const result = await pool.query('SELECT * FROM parents WHERE email = $1', [email]);

    if (result.rows.length === 0) return res.status(401).json({ success: false, message: 'Invalid email or password' });

    const parent = result.rows[0];

    // Auto-verify parents who aren't verified yet
    if (!parent.is_verified) {
      await pool.query('UPDATE parents SET is_verified = true WHERE id = $1', [parent.id]);
    }

    const isMatch = await bcrypt.compare(password, parent.password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid email or password' });

    const token = generateToken(parent.id, 'parent');

    return res.json({
      success: true,
      message: 'Login successful!',
      token,
      parent: {
        id:       parent.id,
        fullName: parent.full_name,
        email:    parent.email,
        role:     'parent',
        phone:    parent.phone,
      }
    });
  } catch (error) {
    console.error('Parent login error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// REGISTER PARENT
// POST /api/auth/parent/register
// ══════════════════════════════════════════════
const registerParent = async (req, res) => {
  const { fullName, email, password, phone, schoolCode } = req.body;
  if (!fullName || !email || !password) {
    return res.status(400).json({ success: false, message: 'Full name, email and password are required' });
  }

  try {
    const existing = await pool.query('SELECT id FROM parents WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists' });
    }

    let schoolId = null;
    if (schoolCode) {
      const schoolResult = await pool.query('SELECT id FROM schools WHERE code = $1', [schoolCode.toUpperCase()]);
      if (schoolResult.rows.length > 0) schoolId = schoolResult.rows[0].id;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO parents (full_name, email, password, phone, school_id, is_verified)
       VALUES ($1, $2, $3, $4, $5, true) RETURNING id, full_name, email`,
      [fullName, email, hashedPassword, phone || null, schoolId]
    );

    const parent = result.rows[0];
    const token  = generateToken(parent.id, 'parent');

    return res.status(201).json({
      success: true,
      message: 'Parent account created successfully!',
      token,
      parent: { id: parent.id, fullName: parent.full_name, email: parent.email, role: 'parent' }
    });
  } catch (error) {
    console.error('Register parent error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  registerSchool,
  registerStudent,
  registerTeacher,
  registerParent,
  verifyEmail,
  login,
  loginStudent,
  loginSchool,
  loginParent,
  forgotPassword,
  resetPassword,
  getGradeLetter
};