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
    from: `"AcePrep 🎓" <${process.env.EMAIL_USER}>`,
    to:   toEmail,
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
            <p>Thank you for creating an account. You are one step away from accessing Ghana's best exam preparation platform.</p>
            <p>Click the button below to verify your email address and activate your account:</p>
            <a href="${verificationLink}" class="btn">✅ Verify My Account</a>
            <div class="expire">
              ⏰ This verification link expires in <strong>24 hours</strong>. 
              If you did not create an account, please ignore this email.
            </div>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #2E86AB; font-size: 13px;">${verificationLink}</p>
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
// SEND WELCOME EMAIL (after verification)
// ══════════════════════════════════════════════
const sendWelcomeEmail = async (toEmail, fullName) => {
  const mailOptions = {
    from: `"AcePrep 🎓" <${process.env.EMAIL_USER}>`,
    to:   toEmail,
    subject: 'Welcome to AcePrep — Let\'s Ace Those Exams! 🎓',
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
          .footer     { background: #f4f4f4; padding: 20px; text-align: center; font-size: 12px; color: #999999; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>ACEPREP</h1>
            <p>Ghana's Premier BECE & WASSCE Exam Prep Platform</p>
          </div>
          <div class="body">
            <h2>You're all set, ${fullName}! 🚀</h2>
            <p>Your AcePrep account has been verified and activated. You now have full access to:</p>
            <p>✅ Past questions bank (BECE & WASSCE)</p>
            <p>✅ AI-powered mock exams</p>
            <p>✅ Offline study mode</p>
            <p>✅ Progress tracking & analytics</p>
            <p>✅ Video lessons by Ghanaian teachers</p>
            <p style="margin-top: 30px;">Study hard and ace those exams! 💪🏾</p>
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
// SEND SCHOOL ADMIN VERIFICATION EMAIL
// ══════════════════════════════════════════════
const sendSchoolVerificationEmail = async (toEmail, schoolName, token) => {
  const verificationLink = `http://localhost:3001/verify?token=${token}`;

  const mailOptions = {
    from: `"AcePrep 🎓" <${process.env.EMAIL_USER}>`,
    to:   toEmail,
    subject: `Verify your AcePrep School Account — ${schoolName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body        { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
          .container  { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 10px; overflow: hidden; }
          .header     { background: #1A5276; padding: 30px; text-align: center; }
          .header h1  { color: #ffffff; margin: 0; font-size: 32px; letter-spacing: 2px; }
          .header p   { color: #AED6F1; margin: 5px 0 0; font-size: 14px; }
          .school     { background: #2E86AB; padding: 16px 30px; text-align: center; }
          .school p   { color: #ffffff; margin: 0; font-size: 18px; font-weight: bold; }
          .body       { padding: 40px 30px; }
          .body h2    { color: #1A5276; }
          .body p     { color: #555555; line-height: 1.6; }
          .btn        { display: inline-block; margin: 25px 0; padding: 14px 32px; background: #1A5276; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold; }
          .code-box   { background: #EAF4FB; border: 2px dashed #2E86AB; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0; }
          .code       { font-size: 24px; font-weight: bold; color: #1A5276; letter-spacing: 4px; }
          .expire     { background: #FEF9E7; border-left: 4px solid #F39C12; padding: 12px 16px; margin: 20px 0; border-radius: 4px; font-size: 13px; color: #7D6608; }
          .footer     { background: #f4f4f4; padding: 20px; text-align: center; font-size: 12px; color: #999999; }
          .privacy    { background: #EAFAF1; border-left: 4px solid #27AE60; padding: 12px 16px; margin: 20px 0; border-radius: 4px; font-size: 13px; color: #1E8449; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>ACEPREP</h1>
            <p>School Administration Portal</p>
          </div>
          <div class="school">
            <p>🏫 ${schoolName}</p>
          </div>
          <div class="body">
            <h2>Welcome to AcePrep, ${schoolName}! 🎉</h2>
            <p>Your school has been successfully registered on AcePrep — Ghana's Premier BECE & WASSCE Exam Prep Platform.</p>
            <p>Click the button below to verify your school admin account and get started:</p>
            <a href="${verificationLink}" class="btn">✅ Verify School Account</a>
            <div class="code-box">
              <p style="margin:0;color:#888;font-size:13px;">Your School Code</p>
              <p class="code">${token.substring(0, 8).toUpperCase()}</p>
              <p style="margin:0;color:#888;font-size:12px;">Share this code with your students</p>
            </div>
            <div class="privacy">
              🔒 <strong>Privacy Notice:</strong> AcePrep does not share your school data with any third party. Only your authorized teachers and administrators can view student data.
            </div>
            <div class="expire">
              ⏰ This verification link expires in <strong>24 hours</strong>.
            </div>
            <p>If the button doesn't work, copy and paste this link:</p>
            <p style="word-break:break-all;color:#2E86AB;font-size:13px;">${verificationLink}</p>
          </div>
          <div class="footer">
            <p>AcePrep — Ace Your Exams. Change Your Future.</p>
            <p>© 2026 AcePrep | All Rights Reserved | School Administration Portal</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  await transporter.sendMail(mailOptions);
};

// ══════════════════════════════════════════════
// SEND SCHOOL WELCOME EMAIL (after verification)
// ══════════════════════════════════════════════
const sendSchoolWelcomeEmail = async (toEmail, schoolName) => {
  const mailOptions = {
    from: `"AcePrep 🎓" <${process.env.EMAIL_USER}>`,
    to:   toEmail,
    subject: `Welcome to AcePrep — ${schoolName} is now verified! 🏫`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body        { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
          .container  { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 10px; overflow: hidden; }
          .header     { background: #1A5276; padding: 30px; text-align: center; }
          .header h1  { color: #ffffff; margin: 0; font-size: 32px; letter-spacing: 2px; }
          .body       { padding: 40px 30px; }
          .body h2    { color: #1A5276; }
          .body p     { color: #555555; line-height: 1.6; }
          .feature    { display: flex; align-items: flex-start; margin: 12px 0; }
          .footer     { background: #f4f4f4; padding: 20px; text-align: center; font-size: 12px; color: #999999; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>ACEPREP</h1>
            <p>School Administration Portal</p>
          </div>
          <div class="body">
            <h2>🏫 ${schoolName} is now verified!</h2>
            <p>Your school admin account has been verified. You now have full access to the AcePrep School Dashboard.</p>
            <p>Here is what you can do:</p>
            <p>✅ Create and publish exams for your students</p>
            <p>✅ Monitor student login activity and study time</p>
            <p>✅ View student grades instantly when submitted</p>
            <p>✅ Add teachers with individual login accounts</p>
            <p>✅ Assign homework and track submissions</p>
            <p>✅ Generate school-branded progress reports</p>
            <p style="margin-top:24px;">Login to your dashboard at: <strong>http://localhost:3001</strong></p>
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

module.exports = { sendVerificationEmail, sendWelcomeEmail, sendSchoolVerificationEmail, sendSchoolWelcomeEmail, };