const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

/**
 * Send an email
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - Email HTML body
 */
async function sendEmail(to, subject, html) {
    try {
        const info = await transporter.sendMail({
            from: `"Gate Entry System" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html,
        });
        console.log('Email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Email send error:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Send approval request notification to super admin
 */
async function sendApprovalRequest(societyName, adminName, adminEmail, adminMobile) {
    const subject = '[] New Society Signup — Approval Required';
    const html = `
    <h2>New Society Signup — Approval Required</h2>
    <table style="border-collapse:collapse;">
      <tr><td style="padding:8px;font-weight:bold;">Society:</td><td style="padding:8px;">${societyName}</td></tr>
      <tr><td style="padding:8px;font-weight:bold;">Admin:</td><td style="padding:8px;">${adminName} (${adminEmail})</td></tr>
      <tr><td style="padding:8px;font-weight:bold;">Mobile:</td><td style="padding:8px;">${adminMobile}</td></tr>
    </table>
    <p><strong>Action:</strong> InsForge dashboard → society_admins → set status = active</p>
  `;
    return sendEmail(process.env.SUPERADMIN_EMAIL, subject, html);
}

/**
 * Send email verification link to a new admin
 */
async function sendVerificationEmail(email, name, token) {
    const verifyUrl = `${process.env.CLIENT_URL}/api/auth/verify-email?token=${token}`;
    const subject = 'Verify Your Email — Gate Entry System';
    const html = `
    <h2>Welcome, ${name}!</h2>
    <p>Please verify your email address by clicking the link below:</p>
    <p><a href="${verifyUrl}" style="display:inline-block;padding:12px 24px;background:#1F4E8C;color:#fff;text-decoration:none;border-radius:6px;">Verify Email</a></p>
    <p>This link expires in 24 hours.</p>
    <p>If you did not register, please ignore this email.</p>
  `;
    return sendEmail(email, subject, html);
}

/**
 * Send password reset link
 */
async function sendPasswordResetEmail(email, name, token) {
    const resetUrl = `${process.env.CLIENT_URL}/admin/reset-password?token=${token}`;
    const subject = 'Password Reset — Gate Entry System';
    const html = `
    <h2>Password Reset</h2>
    <p>Hi ${name}, click below to reset your password:</p>
    <p><a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#1F4E8C;color:#fff;text-decoration:none;border-radius:6px;">Reset Password</a></p>
    <p>This link expires in 1 hour.</p>
    <p>If you did not request this, ignore this email.</p>
  `;
    return sendEmail(email, subject, html);
}

module.exports = {
    sendEmail,
    sendApprovalRequest,
    sendVerificationEmail,
    sendPasswordResetEmail,
};
