const pool   = require('../config/db');
const multer = require('multer');
const path   = require('path');

// ── Multer storage for logos ───────────────────
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/logos/');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `school-${req.schoolId}-logo${ext}`);
  }
});

// ── Multer storage for materials ───────────────
const materialStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/materials/');
  },
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const name = file.originalname.replace(/[^a-zA-Z0-9]/g, '-');
    cb(null, `material-${Date.now()}-${name}${ext}`);
  }
});

// ── File filters ───────────────────────────────
const imageFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const fileFilter = (req, file, cb) => {
  const allowed = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg', 'image/png',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('File type not supported'), false);
  }
};

// ── Multer middleware instances ────────────────
const uploadLogoMiddleware = multer({
  storage:   logoStorage,
  fileFilter: imageFilter,
  limits:    { fileSize: 5 * 1024 * 1024 }
});

const uploadMaterialMiddleware = multer({
  storage:   materialStorage,
  fileFilter: fileFilter,
  limits:    { fileSize: 20 * 1024 * 1024 }
});

// ══════════════════════════════════════════════
// UPLOAD SCHOOL LOGO
// POST /api/upload/logo
// ══════════════════════════════════════════════
const uploadSchoolLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const logoUrl = `/uploads/logos/${req.file.filename}`;

    await pool.query(
      'UPDATE schools SET logo_url = $1 WHERE id = $2',
      [logoUrl, req.schoolId]
    );

    return res.status(200).json({
      success: true,
      message: 'Logo uploaded successfully!',
      logoUrl
    });

  } catch (error) {
    console.error('Upload logo error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// UPLOAD STUDY MATERIAL
// POST /api/upload/material
// ══════════════════════════════════════════════
const uploadStudyMaterial = async (req, res) => {
  const { title, description, subject, level, yearGroup, content } = req.body;

  if (!title || !subject) {
    return res.status(400).json({
      success: false,
      message: 'Title and subject are required'
    });
  }

  try {
    const fileUrl  = req.file ? `/uploads/materials/${req.file.filename}` : null;
    const fileType = req.file ? req.file.mimetype : null;

    const result = await pool.query(
      `INSERT INTO study_materials
        (school_id, teacher_id, title, description, subject,
         level, year_group, file_url, file_type, content)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        req.schoolId, req.userId, title, description || null, subject,
        level || null, yearGroup ? parseInt(yearGroup) : null,
        fileUrl, fileType, content || null
      ]
    );

    return res.status(201).json({
      success:  true,
      message:  'Study material uploaded!',
      material: result.rows[0]
    });

  } catch (error) {
    console.error('Upload material error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// GET STUDY MATERIALS
// GET /api/upload/materials
// ══════════════════════════════════════════════
const getStudyMaterials = async (req, res) => {
  try {
    let schoolId = req.schoolId;

    // If student, get their school
    if (!schoolId) {
      const s = await pool.query(
        'SELECT school_id FROM students WHERE id = $1',
        [req.userId]
      );
      schoolId = s.rows[0]?.school_id;
    }

    if (!schoolId) {
      return res.status(200).json({ success: true, total: 0, materials: [] });
    }

    const result = await pool.query(
      `SELECT m.*, t.full_name as teacher_name
       FROM study_materials m
       LEFT JOIN teachers t ON t.id = m.teacher_id
       WHERE m.school_id = $1
       ORDER BY m.created_at DESC`,
      [schoolId]
    );

    return res.status(200).json({
      success:   true,
      total:     result.rows.length,
      materials: result.rows.map(m => ({
        id:          m.id,
        title:       m.title,
        description: m.description,
        subject:     m.subject,
        level:       m.level,
        yearGroup:   m.year_group,
        fileUrl:     m.file_url,
        fileType:    m.file_type,
        content:     m.content,
        teacherName: m.teacher_name,
        createdAt:   m.created_at,
      }))
    });

  } catch (error) {
    console.error('Get materials error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════
// DELETE STUDY MATERIAL
// DELETE /api/upload/materials/:id
// ══════════════════════════════════════════════
const deleteStudyMaterial = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      'DELETE FROM study_materials WHERE id = $1 AND school_id = $2',
      [id, req.schoolId]
    );
    return res.status(200).json({ success: true, message: 'Material deleted' });
  } catch (error) {
    console.error('Delete material error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  uploadLogoMiddleware,
  uploadMaterialMiddleware,
  uploadSchoolLogo,
  uploadStudyMaterial,
  getStudyMaterials,
  deleteStudyMaterial,
};