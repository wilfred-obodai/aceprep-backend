const express = require('express');
const router  = express.Router();
const { protect, adminOnly, studentOnly } = require('../middleware/auth');
const {
  uploadLogoMiddleware,
  uploadMaterialMiddleware,
  uploadSchoolLogo,
  uploadStudyMaterial,
  getStudyMaterials,
} = require('../controllers/uploadController');

router.post('/logo',      protect, adminOnly,  uploadLogoMiddleware.single('logo'),         uploadSchoolLogo);
router.post('/material',  protect, adminOnly,  uploadMaterialMiddleware.single('file'),     uploadStudyMaterial);
router.get('/materials',  protect,             getStudyMaterials);

module.exports = router;