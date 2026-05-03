const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const pool    = require('../config/db');
const { protect, adminOnly, studentOnly } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads/pdfs')),
  filename:    (req, file, cb) => cb(null, `pdf-${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage, fileFilter: (req, file, cb) => {
  if (file.mimetype === 'application/pdf') cb(null, true);
  else cb(new Error('Only PDF files allowed'));
}});

// Upload PDF (school admin/teacher)
router.post('/upload', protect, adminOnly, upload.single('pdf'), async (req, res) => {
  try {
    const { subject, exam_year, level, exam_type } = req.body;
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const fileUrl = `/uploads/pdfs/${req.file.filename}`;

    const result = await pool.query(
      `INSERT INTO past_question_pdfs (subject, exam_type, exam_year, level, file_url, file_name)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [subject, exam_type || 'BECE', exam_year, level || 'JHS', fileUrl, req.file.originalname]
    );

    res.json({ success: true, pdf: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get all PDFs (for students)
router.get('/', protect, async (req, res) => {
  try {
    const { subject, exam_year } = req.query;
    let query = 'SELECT * FROM past_question_pdfs WHERE 1=1';
    const params = [];

    if (subject)   { params.push(subject);   query += ` AND subject = $${params.length}`; }
    if (exam_year) { params.push(exam_year); query += ` AND exam_year = $${params.length}`; }

    query += ' ORDER BY exam_year DESC, subject ASC';
    const result = await pool.query(query, params);
    res.json({ success: true, pdfs: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete PDF (admin only)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    await pool.query('DELETE FROM past_question_pdfs WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'PDF deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;