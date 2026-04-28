const nodemailer = require('nodemailer');
require('dotenv').config();

// ── Create transporter ─────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ── Verify connection ──────────────────────────
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Email service error:', error.message);
  } else {
    console.log('✅ Email service ready!');
  }
});

// ══════════════════════════════════════════════
// SEND VERIFICATION EMAIL
// ══════════════════════════════════════════════
const sendVerificationEmail = async (toEmail, fullName, token) => {
  const verificationLink = `http://localhost:5000/api/auth/verify-email?token=${token}`;
  const mailOptions = {
    from:    `"AcePrep 🎓" <${process.env.EMAIL_USER}>`,
    to:      toEmail,
    subject: 'Verify your AcePrep account',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body        { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
          .container  { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 10px; overflow: hidden; }
          .header     { background: #2E86AB; padding: 30px; text-align: center; }
          .header h1  { color: #ffffff; margin: 0; font-size: 32px; letter-spacing: 2px; }
          .header p   { color: #d0eaf5; margin: 5px 0 0; font-size: 14px; }
          .body       { padding: 40px 30px; }
          .body h2    { color: #1A5276; }
          .body p     { color: #555555; line-height: 1.6; }
          .btn        { display: inline-block; margin: 25px 0; padding: 14px 32px; background: #2E86AB; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold; }
          .footer     { background: #f4f4f4; padding: 20px; text-align: center; font-size: 12px; color: #999999; }
          .expire     { background: #FEF9E7; border-left: 4px solid #F39C12; padding: 12px 16px; margin: 20px 0; border-radius: 4px; font-size: 13px; color: #7D6608; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>ACEPREP</h1>
            <p>Ghana's Premier BECE & WASSCE Exam Prep Platform</p>
          </div>
          <div class="body">
            <h2>Welcome to AcePrep, ${fullName}! 🎉</h2>
            <p>Thank you for creating an account. Click the button below to verify your email:</p>
            <a href="${verificationLink}" class="btn">✅ Verify My Account</a>
            <div class="expire">
              ⏰ This link expires in <strong>24 hours</strong>.
            </div>
            <p>If the button doesn't work, copy this link:</p>
            <p style="word-break:break-all;color:#2E86AB;font-size:13px;">${verificationLink}</p>
          </div>
          <div class="footer">
            <p>AcePrep — Ace Your Exams. Change Your Future.</p>
            <p>© 2026 AcePrep | All Rights Reserved</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };
  await transporter.sendMail(mailOptions);
};

// ══════════════════════════════════════════════
// SEND WELCOME EMAIL
// ══════════════════════════════════════════════
const sendWelcomeEmail = async (toEmail, fullName) => {
  const mailOptions = {
    from:    `"AcePrep 🎓" <${process.env.EMAIL_USER}>`,
    to:      toEmail,
    subject: 'Welcome to AcePrep — Let\'s Ace Those Exams! 🎓',
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0;">
        <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:10px;overflow:hidden;">
          <div style="background:#2E86AB;padding:30px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:32px;letter-spacing:2px;">ACEPREP</h1>
            <p style="color:#d0eaf5;margin:5px 0 0;font-size:14px;">Ghana's Premier BECE & WASSCE Exam Prep Platform</p>
          </div>
          <div style="padding:40px 30px;">
            <h2 style="color:#1A5276;">You're all set, ${fullName}! 🚀</h2>
            <p style="color:#555;line-height:1.6;">Your AcePrep account has been verified. You now have full access to:</p>
            <p style="color:#555;">✅ Past questions bank (BECE & WASSCE)</p>
            <p style="color:#555;">✅ AI-powered tutor</p>
            <p style="color:#555;">✅ Online exams & assignments</p>
            <p style="color:#555;">✅ Progress tracking & leaderboard</p>
            <p style="color:#555;">✅ Study streak & badges</p>
            <p style="color:#555;margin-top:24px;">Study hard and ace those exams! 💪🏾</p>
          </div>
          <div style="background:#f4f4f4;padding:20px;text-align:center;font-size:12px;color:#999;">
            <p>AcePrep — Ace Your Exams. Change Your Future.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };
  await transporter.sendMail(mailOptions);
};

// ══════════════════════════════════════════════
// SEND SCHOOL VERIFICATION EMAIL
// ══════════════════════════════════════════════
const sendSchoolVerificationEmail = async (toEmail, schoolName, token) => {
  const verificationLink = `http://localhost:3000/verify?token=${token}`;
  const mailOptions = {
    from:    `"AcePrep 🎓" <${process.env.EMAIL_USER}>`,
    to:      toEmail,
    subject: `Verify your AcePrep School Account — ${schoolName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0;">
        <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:10px;overflow:hidden;">
          <div style="background:#1A5276;padding:30px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:32px;letter-spacing:2px;">ACEPREP</h1>
            <p style="color:#AED6F1;margin:5px 0 0;">School Administration Portal</p>
          </div>
          <div style="background:#2E86AB;padding:16px 30px;text-align:center;">
            <p style="color:#fff;margin:0;font-size:18px;font-weight:bold;">🏫 ${schoolName}</p>
          </div>
          <div style="padding:40px 30px;">
            <h2 style="color:#1A5276;">Welcome to AcePrep, ${schoolName}! 🎉</h2>
            <p style="color:#555;line-height:1.6;">Your school has been registered. Click below to verify:</p>
            <a href="${verificationLink}" style="display:inline-block;margin:25px 0;padding:14px 32px;background:#1A5276;color:#fff;text-decoration:none;border-radius:6px;font-size:16px;font-weight:bold;">
              ✅ Verify School Account
            </a>
            <div style="background:#EAFAF1;border-left:4px solid #27AE60;padding:12px 16px;margin:20px 0;border-radius:4px;font-size:13px;color:#1E8449;">
              🔒 AcePrep does not share your school data with any third party.
            </div>
            <div style="background:#FEF9E7;border-left:4px solid #F39C12;padding:12px 16px;margin:20px 0;border-radius:4px;font-size:13px;color:#7D6608;">
              ⏰ This link expires in <strong>24 hours</strong>.
            </div>
          </div>
          <div style="background:#f4f4f4;padding:20px;text-align:center;font-size:12px;color:#999;">
            <p>AcePrep — Ace Your Exams. Change Your Future.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };
  await transporter.sendMail(mailOptions);
};

// ══════════════════════════════════════════════
// SEND SCHOOL WELCOME EMAIL
// ══════════════════════════════════════════════
const sendSchoolWelcomeEmail = async (toEmail, schoolName) => {
  const mailOptions = {
    from:    `"AcePrep 🎓" <${process.env.EMAIL_USER}>`,
    to:      toEmail,
    subject: `Welcome to AcePrep — ${schoolName} is now verified! 🏫`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0;">
        <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:10px;overflow:hidden;">
          <div style="background:#1A5276;padding:30px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:32px;letter-spacing:2px;">ACEPREP</h1>
            <p style="color:#AED6F1;margin:5px 0 0;">School Administration Portal</p>
          </div>
          <div style="padding:40px 30px;">
            <h2 style="color:#1A5276;">🏫 ${schoolName} is now verified!</h2>
            <p style="color:#555;line-height:1.6;">You now have full access to the AcePrep School Dashboard.</p>
            <p style="color:#555;">✅ Create and publish exams</p>
            <p style="color:#555;">✅ Monitor student activity</p>
            <p style="color:#555;">✅ View grades instantly</p>
            <p style="color:#555;">✅ Add teachers with individual logins</p>
            <p style="color:#555;">✅ Assign homework & track submissions</p>
            <p style="color:#555;">✅ Generate report cards & send to parents</p>
            <p style="color:#555;margin-top:24px;">Login at: <strong>http://localhost:3000</strong></p>
          </div>
          <div style="background:#f4f4f4;padding:20px;text-align:center;font-size:12px;color:#999;">
            <p>AcePrep — Ace Your Exams. Change Your Future.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };
  await transporter.sendMail(mailOptions);
};

module.exports = {
  transporter,
  sendVerificationEmail,
  sendWelcomeEmail,
  sendSchoolVerificationEmail,
  sendSchoolWelcomeEmail,
};