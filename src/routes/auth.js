const express   = require('express');
const router    = express.Router();
const rateLimit = require('express-rate-limit');
const { protect, adminOnly } = require('../middleware/auth');
const {
  registerSchool,
  registerStudent,
  registerTeacher,
  verifyEmail,
  login,
} = require('../controllers/authController');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts — please try again in 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many registration attempts — please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many verification attempts — please try again in 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/register/school',  registerLimiter, registerSchool);
router.post('/register/student', registerLimiter, registerStudent);
router.post('/register/teacher', protect, adminOnly, registerTeacher);
router.get('/verify-email',      verifyLimiter,   verifyEmail);
router.post('/login',            loginLimiter,    login);

module.exports = router;