const pool = require('../config/db');
const PDFDocument = require('pdfkit');

const generateReportCard = async (req, res) => {
  const { studentId } = req.params;
  const { term, academicYear } = req.query;

  try {
    // Get student info
    const studentResult = await pool.query(
      `SELECT s.*, sc.name as school_name, sc.code as school_code,
              sc.motto, sc.city, sc.region, sc.phone as school_phone,
              sc.email as school_email, sc.address as school_address
       FROM students s
       LEFT JOIN schools sc ON sc.id = s.school_id
       WHERE s.id = $1`,
      [studentId]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const student = studentResult.rows[0];

    // Check school access
    if (req.schoolId && student.school_id !== req.schoolId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Get grades
    const gradesResult = await pool.query(
      `SELECT subject, assessment_name, assessment_type,
              score, max_score, percentage, grade_letter, created_at
       FROM grades
       WHERE student_id = $1
       ORDER BY subject, created_at DESC`,
      [studentId]
    );

    const grades = gradesResult.rows;

    // Group by subject
    const grouped = grades.reduce((acc, g) => {
      if (!acc[g.subject]) acc[g.subject] = [];
      acc[g.subject].push(g);
      return acc;
    }, {});

    // Calculate overall
    const overallAvg = grades.length > 0
      ? parseFloat((grades.reduce((s, g) => s + parseFloat(g.percentage), 0) / grades.length).toFixed(1))
      : 0;
    const overallGrade =
      overallAvg >= 80 ? 'A' :
      overallAvg >= 70 ? 'B' :
      overallAvg >= 60 ? 'C' :
      overallAvg >= 50 ? 'D' :
      overallAvg >= 40 ? 'E' : 'F';

    // Create PDF
    const doc = new PDFDocument({
      size:    'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 }
    });

    // Set headers BEFORE piping
    const filename = `report-card-${(student.full_name || 'student').replace(/ /g, '-')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Allow-Origin', '*');

    doc.pipe(res);

    // ── HEADER ──────────────────────────────────
    doc.fontSize(24)
       .font('Helvetica-Bold')
       .fillColor('#1A5276')
       .text(student.school_name || 'AcePrep School', { align: 'center' });

    if (student.motto) {
      doc.fontSize(11)
         .font('Helvetica-Oblique')
         .fillColor('#555555')
         .text(`"${student.motto}"`, { align: 'center' });
    }

    if (student.city || student.region) {
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor('#777777')
         .text(
           [student.city, student.region, student.school_phone, student.school_email]
             .filter(Boolean).join(' | '),
           { align: 'center' }
         );
    }

    // Top divider
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y)
       .lineTo(545, doc.y)
       .lineWidth(3)
       .strokeColor('#1A5276')
       .stroke();
    doc.moveDown(0.3);

    // Title
    doc.fontSize(16)
       .font('Helvetica-Bold')
       .fillColor('#1A5276')
       .text('STUDENT REPORT CARD', { align: 'center' });

    doc.fontSize(11)
       .font('Helvetica')
       .fillColor('#555555')
       .text(
         `${term ? `Term: ${term}  |  ` : ''}Academic Year: ${academicYear || new Date().getFullYear()}`,
         { align: 'center' }
       );

    doc.moveDown(0.5);
    doc.moveTo(50, doc.y)
       .lineTo(545, doc.y)
       .lineWidth(1)
       .strokeColor('#AAAAAA')
       .stroke();
    doc.moveDown(0.5);

    // ── STUDENT INFO ─────────────────────────────
    doc.fontSize(13)
       .font('Helvetica-Bold')
       .fillColor('#1A5276')
       .text('STUDENT INFORMATION');
    doc.moveDown(0.3);

    const infoY = doc.y;
    doc.rect(50, infoY, 495, 85)
       .fillColor('#EAF4FB')
       .fill();

    doc.fillColor('#333333').fontSize(11).font('Helvetica-Bold');
    doc.text('Full Name:',   60, infoY + 10);
    doc.text('Level:',       60, infoY + 28);
    doc.text('Year Group:',  60, infoY + 46);
    doc.text('Class:',       60, infoY + 64);

    doc.font('Helvetica').fillColor('#000000');
    doc.text(student.full_name || '—',             180, infoY + 10);
    doc.text(student.level     || '—',             180, infoY + 28);
    doc.text(`Year ${student.year_group || '—'}`,  180, infoY + 46);
    doc.text(student.class_name || '—',            180, infoY + 64);

    doc.font('Helvetica-Bold').fillColor('#333333');
    doc.text('School:',      330, infoY + 10);
    doc.text('School Code:', 330, infoY + 28);
    doc.text('Email:',       330, infoY + 46);

    doc.font('Helvetica').fillColor('#000000');
    doc.text(student.school_name || '—', 420, infoY + 10);
    doc.text(student.school_code || '—', 420, infoY + 28);
    doc.text(student.email       || '—', 420, infoY + 46);

    doc.moveDown(4.5);

    // ── GRADES TABLE ──────────────────────────────
    doc.fontSize(13)
       .font('Helvetica-Bold')
       .fillColor('#1A5276')
       .text('ACADEMIC PERFORMANCE');
    doc.moveDown(0.3);

    if (grades.length === 0) {
      doc.fontSize(11)
         .font('Helvetica')
         .fillColor('#888888')
         .text('No grades recorded yet.', { align: 'center' });
    } else {
      const tableTop  = doc.y;
      const cols      = [50, 190, 320, 385, 445, 500];
      const colWidths = [140, 130, 65,  60,  55,  45 ];
      const headers   = ['Subject', 'Assessment', 'Type', 'Score', 'Percent', 'Grade'];

      // Header row
      doc.rect(50, tableTop, 495, 22)
         .fillColor('#1A5276')
         .fill();

      doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold');
      headers.forEach((h, i) => {
        doc.text(h, cols[i] + 3, tableTop + 6, { width: colWidths[i] });
      });

      let rowY  = tableTop + 22;
      let rowNo = 0;

      Object.entries(grouped).forEach(([subject, subGrades]) => {
        subGrades.forEach((g, gi) => {
          if (rowY > 700) {
            doc.addPage();
            rowY = 50;
          }

          doc.rect(50, rowY, 495, 18)
             .fillColor(rowNo % 2 === 0 ? '#FFFFFF' : '#F5F8FA')
             .fill();

          doc.fillColor('#333333').fontSize(9).font('Helvetica');
          doc.text(gi === 0 ? subject : '',         cols[0] + 3, rowY + 4, { width: colWidths[0] });
          doc.text(g.assessment_name || '—',        cols[1] + 3, rowY + 4, { width: colWidths[1] });
          doc.text(g.assessment_type || '—',        cols[2] + 3, rowY + 4, { width: colWidths[2] });
          doc.text(`${g.score}/${g.max_score}`,     cols[3] + 3, rowY + 4, { width: colWidths[3] });
          doc.text(`${g.percentage}%`,              cols[4] + 3, rowY + 4, { width: colWidths[4] });

          const gc =
            g.grade_letter === 'A' ? '#27AE60' :
            g.grade_letter === 'B' ? '#2E86AB' :
            g.grade_letter === 'C' ? '#2980B9' :
            g.grade_letter === 'D' ? '#F39C12' :
            g.grade_letter === 'F' ? '#E74C3C' : '#555555';

          doc.fillColor(gc).font('Helvetica-Bold');
          doc.text(g.grade_letter || '—', cols[5] + 3, rowY + 4, { width: colWidths[5] });

          rowY  += 18;
          rowNo += 1;
        });

        // Subject average
        if (rowY > 700) { doc.addPage(); rowY = 50; }

        const subAvg = parseFloat(
          (subGrades.reduce((s, g) => s + parseFloat(g.percentage), 0) / subGrades.length).toFixed(1)
        );

        doc.rect(50, rowY, 495, 18)
           .fillColor('#D5E8F3')
           .fill();
        doc.fillColor('#1A5276').fontSize(9).font('Helvetica-Bold');
        doc.text(`${subject} — Average`, cols[0] + 3, rowY + 4, { width: 290 });
        doc.text(`${subAvg}%`,           cols[4] + 3, rowY + 4);
        rowY += 18;
      });

      // Table border
      doc.rect(50, tableTop, 495, rowY - tableTop)
         .lineWidth(0.5)
         .strokeColor('#AAAAAA')
         .stroke();

      doc.y = rowY + 12;
    }

    doc.moveDown(1);

    // ── OVERALL SUMMARY ───────────────────────────
    if (doc.y > 680) doc.addPage();

    const summaryY = doc.y;
    doc.rect(50, summaryY, 495, 65)
       .fillColor('#1A5276')
       .fill();

    doc.fillColor('#FFFFFF').fontSize(13).font('Helvetica-Bold');
    doc.text('OVERALL PERFORMANCE SUMMARY', 60, summaryY + 8);

    doc.fontSize(11).font('Helvetica');
    doc.text(`Total Assessments: ${grades.length}`,  60, summaryY + 28);
    doc.text(`Overall Average: ${overallAvg}%`,      60, summaryY + 46);

    const gradeDisplayColor =
      overallGrade === 'A' ? '#2ECC71' :
      overallGrade === 'B' ? '#AED6F1' :
      overallGrade === 'F' ? '#F1948A' : '#F9E79F';

    doc.fontSize(28).font('Helvetica-Bold').fillColor(gradeDisplayColor);
    doc.text(`Grade: ${overallGrade}`, 380, summaryY + 18);

    doc.y = summaryY + 75;
    doc.moveDown(1.5);

    // ── REMARKS ───────────────────────────────────
    if (doc.y > 680) doc.addPage();

    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1A5276');
    doc.text("Class Teacher's Remarks:");
    doc.moveDown(0.3);
    doc.rect(50, doc.y, 495, 45)
       .lineWidth(1)
       .strokeColor('#AAAAAA')
       .stroke();

    doc.moveDown(3.5);

    // ── SIGNATURES ────────────────────────────────
    if (doc.y > 720) doc.addPage();

    const sigY = doc.y + 10;
    doc.fontSize(10).font('Helvetica').fillColor('#333333');

    doc.moveTo(55,  sigY + 25).lineTo(185, sigY + 25).lineWidth(1).strokeColor('#333333').stroke();
    doc.moveTo(210, sigY + 25).lineTo(340, sigY + 25).stroke();
    doc.moveTo(365, sigY + 25).lineTo(540, sigY + 25).stroke();

    doc.text("Class Teacher's Sign",   55,  sigY + 30, { width: 130 });
    doc.text("Head Teacher's Sign",    210, sigY + 30, { width: 130 });
    doc.text("Parent/Guardian's Sign", 365, sigY + 30, { width: 175 });

    // ── FOOTER ────────────────────────────────────
    doc.fontSize(8)
       .font('Helvetica-Oblique')
       .fillColor('#AAAAAA')
       .text(
         `Generated by AcePrep Platform  |  ${new Date().toLocaleDateString()}  |  ${student.school_name || 'AcePrep School'}`,
         50, 810, { align: 'center', width: 495 }
       );

    doc.end();

  } catch (error) {
    console.error('Report card error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Failed to generate report card' });
    }
  }
};

module.exports = { generateReportCard };