const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const insforge = require('../services/insforge');
const { sendVerificationEmail, sendApprovalRequest, sendPasswordResetEmail } = require('../services/email');
const { notifySuperAdmin } = require('../services/whatsapp');

const router = express.Router();

// In-memory lockout tracker: { 'society_id:mobile': { attempts, lockedUntil } }
const guardLockouts = {};
const LOCKOUT_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 10 * 60 * 1000; // 10 minutes

/**
 * POST /api/auth/guard-login
 * Body: { mobile, pin, society_slug }
 */
router.post('/guard-login', async (req, res) => {
    try {
        const { mobile, pin, society_slug } = req.body;
        if (!mobile || !pin || !society_slug) {
            return res.status(400).json({ error: 'mobile, pin, and society_slug are required' });
        }

        // Find society by slug
        const { data: society, error: socErr } = await insforge.database
            .from('societies')
            .select('id, status')
            .eq('slug', society_slug)
            .single();

        if (socErr || !society) {
            return res.status(404).json({ error: 'Society not found' });
        }
        if (society.status === 'suspended') {
            return res.status(403).json({ error: 'This society has been suspended' });
        }
        if (society.status !== 'active') {
            return res.status(403).json({ error: 'This society is not active yet' });
        }

        // Check lockout
        const lockoutKey = `${society.id}:${mobile}`;
        const lockout = guardLockouts[lockoutKey];
        if (lockout && lockout.lockedUntil && Date.now() < lockout.lockedUntil) {
            const remainingSec = Math.ceil((lockout.lockedUntil - Date.now()) / 1000);
            return res.status(429).json({
                error: `Too many attempts. Try again in ${remainingSec} seconds.`,
                lockedUntil: lockout.lockedUntil,
            });
        }

        // Find guard
        const { data: guard, error: guardErr } = await insforge.database
            .from('guards')
            .select('id, name, mobile, pin_hash, active')
            .eq('society_id', society.id)
            .eq('mobile', mobile)
            .single();

        if (guardErr || !guard) {
            // Increment lockout counter
            if (!guardLockouts[lockoutKey]) guardLockouts[lockoutKey] = { attempts: 0, lockedUntil: null };
            guardLockouts[lockoutKey].attempts += 1;
            if (guardLockouts[lockoutKey].attempts >= LOCKOUT_ATTEMPTS) {
                guardLockouts[lockoutKey].lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
            }
            return res.status(401).json({ error: 'Invalid mobile number or PIN' });
        }

        if (!guard.active) {
            return res.status(403).json({ error: 'Your account has been deactivated. Contact your admin.' });
        }

        // Verify PIN
        const validPin = await bcrypt.compare(pin, guard.pin_hash);
        if (!validPin) {
            if (!guardLockouts[lockoutKey]) guardLockouts[lockoutKey] = { attempts: 0, lockedUntil: null };
            guardLockouts[lockoutKey].attempts += 1;
            if (guardLockouts[lockoutKey].attempts >= LOCKOUT_ATTEMPTS) {
                guardLockouts[lockoutKey].lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
            }
            return res.status(401).json({ error: 'Invalid mobile number or PIN' });
        }

        // Clear lockout on success
        delete guardLockouts[lockoutKey];

        // Issue JWT
        const token = jwt.sign(
            { role: 'guard', guard_id: guard.id, society_id: society.id },
            process.env.JWT_SECRET,
            { expiresIn: '12h' }
        );

        // Log guard activity
        await insforge.database.from('guard_activity').insert({
            society_id: society.id,
            guard_id: guard.id,
            action: 'LOGIN',
            detail: `Guard ${guard.name} logged in`,
        });

        return res.json({
            token,
            guard: { id: guard.id, name: guard.name, mobile: guard.mobile },
            society_id: society.id,
        });
    } catch (error) {
        console.error('Guard login error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/auth/admin-register
 * Body: { society_name, society_address, name, email, password, mobile }
 */
router.post('/admin-register', async (req, res) => {
    try {
        const { society_name, society_address, name, email, password, mobile } = req.body;

        if (!society_name || !name || !email || !password || !mobile) {
            return res.status(400).json({ error: 'society_name, name, email, password, and mobile are required' });
        }
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }
        if (!/\d/.test(password)) {
            return res.status(400).json({ error: 'Password must contain at least one number' });
        }
        if (!/^\d{10}$/.test(mobile)) {
            return res.status(400).json({ error: 'Mobile must be a 10-digit number' });
        }

        // Check email uniqueness
        const { data: existingAdmin } = await insforge.database
            .from('society_admins')
            .select('id')
            .eq('email', email.toLowerCase())
            .maybeSingle();

        if (existingAdmin) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        // Generate slug from society name
        const slug = society_name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

        // Check slug uniqueness
        const { data: existingSociety } = await insforge.database
            .from('societies')
            .select('id')
            .eq('slug', slug)
            .maybeSingle();

        if (existingSociety) {
            return res.status(409).json({ error: 'A society with a similar name already exists. Please choose a different name.' });
        }

        // Insert society
        const { data: society, error: socErr } = await insforge.database
            .from('societies')
            .insert({
                name: society_name,
                slug,
                address: society_address || null,
                status: 'pending',
            })
            .select()
            .single();

        if (socErr) {
            console.error('Society insert error:', socErr);
            return res.status(500).json({ error: 'Failed to create society' });
        }

        // Hash password
        const password_hash = await bcrypt.hash(password, 12);

        // Insert admin
        const { data: admin, error: adminErr } = await insforge.database
            .from('society_admins')
            .insert({
                society_id: society.id,
                name,
                email: email.toLowerCase(),
                password_hash,
                mobile,
                email_verified: false,
                status: 'pending',
            })
            .select()
            .single();

        if (adminErr) {
            console.error('Admin insert error:', adminErr);
            // Clean up: delete the society we just created
            await insforge.database.from('societies').delete().eq('id', society.id);
            return res.status(500).json({ error: 'Failed to create admin account' });
        }

        // Send email verification link
        const verifyToken = jwt.sign(
            { email: email.toLowerCase(), admin_id: admin.id, type: 'email_verify' },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        await sendVerificationEmail(email.toLowerCase(), name, verifyToken);

        return res.status(201).json({
            message: 'Registration successful! Check your email to verify your address.',
            society: { id: society.id, name: society.name, slug },
        });
    } catch (error) {
        console.error('Admin register error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/auth/verify-email?token=xxx
 */
router.get('/verify-email', async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) {
            return res.status(400).json({ error: 'Token is required' });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (e) {
            return res.status(400).json({ error: 'Invalid or expired verification link. Please request a new one.' });
        }

        if (decoded.type !== 'email_verify') {
            return res.status(400).json({ error: 'Invalid token type' });
        }

        // Set email_verified = true
        const { data: admin, error } = await insforge.database
            .from('society_admins')
            .update({ email_verified: true })
            .eq('id', decoded.admin_id)
            .select('*, societies:society_id(name)')
            .single();

        if (error || !admin) {
            return res.status(400).json({ error: 'Failed to verify email' });
        }

        // Notify super admin
        const societyName = admin.societies?.name || 'Unknown';
        await sendApprovalRequest(societyName, admin.name, admin.email, admin.mobile);
        await notifySuperAdmin(societyName, admin.name, admin.email, admin.mobile);

        return res.json({ message: 'Email verified successfully! Your account is now awaiting super admin approval.' });
    } catch (error) {
        console.error('Verify email error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/auth/admin-login
 * Body: { email, password }
 */
router.post('/admin-login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const { data: admin, error } = await insforge.database
            .from('society_admins')
            .select('id, society_id, name, email, password_hash, email_verified, status, mobile')
            .eq('email', email.toLowerCase())
            .single();

        if (error || !admin) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Check email verified
        if (!admin.email_verified) {
            return res.status(403).json({ error: 'Please verify your email address first' });
        }

        // Check status
        switch (admin.status) {
            case 'pending':
                return res.status(403).json({ error: 'Your account is awaiting approval' });
            case 'rejected':
                return res.status(403).json({ error: 'Your registration was rejected' });
            case 'suspended':
                return res.status(403).json({ error: 'Your account has been suspended' });
        }

        // Check society status too
        const { data: society } = await insforge.database
            .from('societies')
            .select('status')
            .eq('id', admin.society_id)
            .single();

        if (society && society.status === 'suspended') {
            return res.status(403).json({ error: 'Your society has been suspended. Contact support.' });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, admin.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Issue JWT
        const token = jwt.sign(
            { role: 'admin', admin_id: admin.id, society_id: admin.society_id },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        return res.json({
            token,
            admin: { id: admin.id, name: admin.name, email: admin.email, mobile: admin.mobile },
            society_id: admin.society_id,
        });
    } catch (error) {
        console.error('Admin login error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 */
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const { data: admin } = await insforge.database
            .from('society_admins')
            .select('id, name, email')
            .eq('email', email.toLowerCase())
            .maybeSingle();

        // Always return success to prevent email enumeration
        if (!admin) {
            return res.json({ message: 'If an account exists with that email, a reset link has been sent.' });
        }

        const resetToken = jwt.sign(
            { admin_id: admin.id, email: admin.email, type: 'password_reset' },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );
        await sendPasswordResetEmail(admin.email, admin.name, resetToken);

        return res.json({ message: 'If an account exists with that email, a reset link has been sent.' });
    } catch (error) {
        console.error('Forgot password error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/auth/reset-password
 * Body: { token, password }
 */
router.post('/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;
        if (!token || !password) {
            return res.status(400).json({ error: 'Token and new password are required' });
        }
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch {
            return res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });
        }

        if (decoded.type !== 'password_reset') {
            return res.status(400).json({ error: 'Invalid token type' });
        }

        const password_hash = await bcrypt.hash(password, 12);
        const { error } = await insforge.database
            .from('society_admins')
            .update({ password_hash })
            .eq('id', decoded.admin_id);

        if (error) {
            return res.status(500).json({ error: 'Failed to reset password' });
        }

        return res.json({ message: 'Password reset successfully. You can now login with your new password.' });
    } catch (error) {
        console.error('Reset password error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
