const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const path       = require('path');
const http       = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app    = express();
const server = http.createServer(app);

// ── Trust proxy for Render/production ─────────
app.set('trust proxy', 1);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// ── Middleware ─────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Static files ───────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── Routes ─────────────────────────────────────
const authRoutes             = require('./routes/auth');
const schoolRoutes           = require('./routes/schools');
const studentRoutes          = require('./routes/students');
const gradeRoutes            = require('./routes/grades');
const questionRoutes         = require('./routes/questions');
const examRoutes             = require('./routes/exams');
const assignmentRoutes       = require('./routes/assignments');
const reportCardRoutes       = require('./routes/reportCard');
const leaderboardRoutes      = require('./routes/leaderboard');
const streakRoutes           = require('./routes/streaks');
const parentRoutes           = require('./routes/parents');
const announcementRoutes     = require('./routes/announcements');
const timetableRoutes        = require('./routes/timetable');
const uploadRoutes           = require('./routes/upload');
const attendanceRoutes       = require('./routes/attendance');
const messageRoutes          = require('./routes/messages');
const aiRoutes               = require('./routes/ai');
const xpRoutes               = require('./routes/xp');
const analyticsRoutes        = require('./routes/analytics');
const videoRoomRoutes        = require('./routes/videoRooms');
const battleRoutes           = require('./routes/battle');
const pastQuestionsPdfRoutes = require('./routes/pastQuestionsPdf');
const aiTutorHistoryRoutes   = require('./routes/aiTutorHistory');
const notificationRoutes     = require('./routes/notifications');

app.use('/api/auth',               authRoutes);
app.use('/api/schools',            schoolRoutes);
app.use('/api/students',           studentRoutes);
app.use('/api/grades',             gradeRoutes);
app.use('/api/questions',          questionRoutes);
app.use('/api/exams',              examRoutes);
app.use('/api/assignments',        assignmentRoutes);
app.use('/api/report-card',        reportCardRoutes);
app.use('/api/leaderboard',        leaderboardRoutes);
app.use('/api/streaks',            streakRoutes);
app.use('/api/parents',            parentRoutes);
app.use('/api/announcements',      announcementRoutes);
app.use('/api/timetable',          timetableRoutes);
app.use('/api/upload',             uploadRoutes);
app.use('/api/attendance',         attendanceRoutes);
app.use('/api/messages',           messageRoutes);
app.use('/api/ai',                 aiRoutes);
app.use('/api/xp',                 xpRoutes);
app.use('/api/analytics',          analyticsRoutes);
app.use('/api/video-rooms',        videoRoomRoutes);
app.use('/api/battle',             battleRoutes);
app.use('/api/past-questions-pdf', pastQuestionsPdfRoutes);
app.use('/api/ai-tutor-history',   aiTutorHistoryRoutes);
app.use('/api/notifications',      notificationRoutes);

// ── Health check ───────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', message: 'AcePrep API is running' }));

// ── Socket.io for Quiz Battle ──────────────────
const battleRooms = {};

io.on('connection', (socket) => {
  socket.on('join_battle', ({ roomCode, studentId, fullName }) => {
    socket.join(roomCode);
    if (!battleRooms[roomCode]) {
      battleRooms[roomCode] = { players: {}, questions: [], currentQ: 0, started: false };
    }
    battleRooms[roomCode].players[studentId] = { fullName, score: 0, answered: false };
    io.to(roomCode).emit('players_update', {
      players: Object.entries(battleRooms[roomCode].players).map(([id, p]) => ({
        studentId: id, fullName: p.fullName, score: p.score,
      }))
    });
  });

  socket.on('start_battle', ({ roomCode, questions }) => {
    if (battleRooms[roomCode]) {
      battleRooms[roomCode].questions = questions;
      battleRooms[roomCode].started   = true;
      battleRooms[roomCode].currentQ  = 0;
      io.to(roomCode).emit('battle_started', {
        question: questions[0], questionNum: 1, total: questions.length,
      });
    }
  });

  socket.on('submit_answer', ({ roomCode, studentId, answer, questionIndex }) => {
    const room = battleRooms[roomCode];
    if (!room) return;

    const q         = room.questions[questionIndex];
    const isCorrect = answer === q?.correctAnswer;
    if (isCorrect && room.players[studentId]) room.players[studentId].score += 10;

    io.to(roomCode).emit('score_update', {
      players: Object.entries(room.players).map(([id, p]) => ({
        studentId: id, fullName: p.fullName, score: p.score,
      }))
    });

    setTimeout(() => {
      room.currentQ++;
      if (room.currentQ < room.questions.length) {
        io.to(roomCode).emit('next_question', {
          question: room.questions[room.currentQ],
          questionNum: room.currentQ + 1,
          total: room.questions.length,
        });
      } else {
        const sorted = Object.entries(room.players)
          .sort(([,a],[,b]) => b.score - a.score)
          .map(([id, p], i) => ({ rank: i+1, studentId: id, fullName: p.fullName, score: p.score }));
        io.to(roomCode).emit('battle_ended', { results: sorted });
        delete battleRooms[roomCode];
      }
    }, 3000);
  });

  socket.on('disconnect', () => {});
});

// ── Start server ───────────────────────────────
require('./config/db');

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`✅ AcePrep backend running on http://localhost:${PORT}`);
});