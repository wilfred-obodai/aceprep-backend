const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
require('dotenv').config();
require('./config/email');

// Import routes
const authRoutes    = require('./routes/auth');
const schoolRoutes  = require('./routes/schools');
const studentRoutes = require('./routes/students');
const gradeRoutes   = require('./routes/grades');
const questionRoutes = require('./routes/questions');
const aiRoutes = require('./routes/ai');
const examRoutes = require('./routes/exams');
const assignmentRoutes = require('./routes/assignments');
const reportCardRoutes = require('./routes/reportCard');

const app = express();

// ── Middleware ──────────────────────────
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
}));
app.use(express.json({ limit: '10kb' }));

// ── Routes ──────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/schools',  schoolRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/grades',   gradeRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/report-card', reportCardRoutes);

// ── Health Check ─────────────────────────
app.get('/', (req, res) => {
  res.json({
    message: '🎓 AcePrep API is running!',
    version: '1.0.0',
    status:  'OK'
  });
});

// ── 404 Handler ──────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Start Server ─────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ AcePrep backend running on http://localhost:${PORT}`);
});

module.exports = app;