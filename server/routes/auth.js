const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const insforge = require('../services/insforge');
const { sendPasswordResetEmail, sendApprovalRequest, sendAdminSignupNotification } = require('../services/email');
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
        if (!mobile || !pin) {
            return res.status(400).json({ error: 'mobile and pin are required' });
        }

        // 1. Gather potential guard records by mobile first
        const { data: guards, error: guardsErr } = await insforge.database
            .from('guards')
            .select('id, name, mobile, pin_hash, active, society_id')
            .eq('mobile', mobile);

        if (guardsErr || !guards || guards.length === 0) {
            return res.status(401).json({ error: 'Invalid mobile number or PIN' });
        }

        let matchedGuard = null;
        let validPinFound = false;

        // 2. Find the first guard record with a matching pin and active status
        for (const g of guards) {
            if (!g.active) continue;

            // Check lockout for this specific society
            const lockoutKey = `${g.society_id}:${mobile}`;
            const lockout = guardLockouts[lockoutKey];
            if (lockout && lockout.lockedUntil && Date.now() < lockout.lockedUntil) {
                continue; // Try next if locked out of this one
            }

            const validPin = await bcrypt.compare(pin, g.pin_hash);
            if (validPin) {
                // If society_slug is provided and not generic, it must match
                if (society_slug && society_slug !== 'entry') {
                    // We need to fetch the society to check its slug
                    const { data: socCheck } = await insforge.database
                        .from('societies')
                        .select('slug')
                        .eq('id', g.society_id)
                        .single();

                    if (!socCheck || socCheck.slug !== society_slug) {
                        continue; // Wrong society context
                    }
                }

                matchedGuard = g;
                validPinFound = true;
                break;
            } else {
                // Register failed attempt
                if (!guardLockouts[lockoutKey]) guardLockouts[lockoutKey] = { attempts: 0, lockedUntil: null };
                guardLockouts[lockoutKey].attempts += 1;
                if (guardLockouts[lockoutKey].attempts >= LOCKOUT_ATTEMPTS) {
                    guardLockouts[lockoutKey].lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
                }
            }
        }

        if (!matchedGuard) {
            if (validPinFound) {
                return res.status(403).json({ error: 'Your account has been deactivated or wrong society context.' });
            }
            return res.status(401).json({ error: 'Invalid mobile number or PIN' });
        }

        const society_id = matchedGuard.society_id;
        const lockoutKey = `${society_id}:${mobile}`;
        delete guardLockouts[lockoutKey];

        // 3. Check society status
        const { data: society, error: socErr } = await insforge.database
            .from('societies')
            .select('id, slug, status, admin_id')
            .eq('id', society_id)
            .single();

        if (socErr || !society) {
            return res.status(404).json({ error: 'Society not found' });
        }
        if (society.status === 'suspended') {
            return res.status(403).json({ error: 'This society has been suspended' });
        }

        // 4. Check society owner (admin) status
        const { data: admin } = await insforge.database
            .from('users')
            .select('status')
            .eq('id', society.admin_id)
            .single();

        if (!admin || admin.status !== 'active') {
            return res.status(403).json({ error: 'The society administrator is not active' });
        }

        // Issue JWT
        const token = jwt.sign(
            { role: 'guard', guard_id: matchedGuard.id, society_id },
            process.env.JWT_SECRET,
            { expiresIn: '12h' }
        );

        // Log guard activity
        await insforge.database.from('guard_activity').insert({
            society_id,
            guard_id: matchedGuard.id,
            action: 'LOGIN',
            detail: `Guard ${matchedGuard.name} logged in`,
        });

        return res.json({
            token,
            guard: { id: matchedGuard.id, name: matchedGuard.name, mobile: matchedGuard.mobile, society_slug: society.slug },
            society_id,
        });
    } catch (error) {
        console.error('Guard login error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/auth/my-societies
 * Get all societies where this guard's mobile is registered
 */
router.get('/my-societies', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Authorized access only' });
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.role !== 'guard') return res.status(403).json({ error: 'Forbidden' });

        // Get guard's mobile
        const { data: guard } = await insforge.database
            .from('guards')
            .select('mobile')
            .eq('id', decoded.guard_id)
            .single();

        if (!guard) return res.status(404).json({ error: 'Guard not found' });

        // Find all records for this mobile
        const { data: guards } = await insforge.database
            .from('guards')
            .select('society_id')
            .eq('mobile', guard.mobile);

        const societyIds = (guards || []).map(g => g.society_id);

        if (societyIds.length === 0) return res.json([]);

        // Fetch societies
        const { data: societies } = await insforge.database
            .from('societies')
            .select('id, name, slug')
            .in('id', societyIds);

        return res.json(societies || []);
    } catch (error) {
        console.error('My societies error:', error);
        return res.status(401).json({ error: 'Session expired' });
    }
});

/**
 * POST /api/auth/admin-register
 * Body: { email, password, name, mobile, society_name, society_address }
 * Uses InsForge auth.signUp for email/password, creates a users row + society row.
 */
router.post('/admin-register', async (req, res) => {
    try {
        const { email, password, name, mobile, society_name, society_address } = req.body;

        if (!email || !password || !name || !mobile || !society_name) {
            return res.status(400).json({ error: 'All fields (email, password, name, mobile, society_name) are required' });
        }
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }
        if (society_name.length < 3) {
            return res.status(400).json({ error: 'Society name must be at least 3 characters' });
        }

        // Check email uniqueness in users table
        const { data: existingUser } = await insforge.database
            .from('users')
            .select('id')
            .eq('email', email.toLowerCase())
            .maybeSingle();

        if (existingUser) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        // Generate slug from society name
        const slug = society_name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();

        // Check slug uniqueness
        const { data: existingSlug } = await insforge.database
            .from('societies')
            .select('id')
            .eq('slug', slug)
            .maybeSingle();

        if (existingSlug) {
            return res.status(409).json({ error: `Society slug "${slug}" already taken. Choose a different name.` });
        }

        // 1. Create auth user via InsForge signUp (email & password)
        const { data: authData, error: authErr } = await insforge.auth.signUp({
            email: email.toLowerCase(),
            password,
            name,
        });

        if (authErr) {
            console.error('InsForge signUp error:', authErr);
            return res.status(500).json({ error: authErr.message || 'Failed to create auth account' });
        }

        const authUserId = authData?.user?.id || null;

        // 2. Insert into users table with pending status
        const { data: user, error: userErr } = await insforge.database
            .from('users')
            .insert({
                email: email.toLowerCase(),
                auth_user_id: authUserId,
                name,
                mobile,
                status: 'pending',
            })
            .select()
            .single();

        if (userErr) {
            console.error('Users table insert error:', userErr);
            return res.status(500).json({ error: 'Failed to create account' });
        }

        // 3. Create society with pending status, linked to user
        const { data: society, error: socErr } = await insforge.database
            .from('societies')
            .insert({
                name: society_name,
                slug,
                address: society_address || null,
                admin_id: user.id,
                status: 'pending',
            })
            .select()
            .single();

        if (socErr) {
            console.error('Society insert error:', socErr);
            // Still return success — user was created, society can be created later
        }

        // 4. Notify super admin via email
        await sendApprovalRequest(society_name, name, email, mobile);

        // 5. Notify super admin via WhatsApp
        await notifySuperAdmin(society_name, name, email, mobile);

        return res.status(201).json({
            message: 'Registration successful! Your account is pending activation by the super admin.',
            user: { id: user.id, email: user.email },
            society: society ? { id: society.id, slug: society.slug } : null,
        });
    } catch (error) {
        console.error('Admin register error:', error);
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
            .from('users')
            .select('id, name, email, password_hash, status, mobile')
            .eq('email', email.toLowerCase())
            .single();

        if (error || !admin) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Check status — only active users can login
        switch (admin.status) {
            case 'pending':
                return res.status(403).json({ error: 'Your account is awaiting activation. Please contact the administrator.' });
            case 'rejected':
                return res.status(403).json({ error: 'Your registration was rejected' });
            case 'suspended':
                return res.status(403).json({ error: 'Your account has been suspended' });
        }

        // Verify password
        let validPassword = false;
        if (admin.password_hash) {
            validPassword = await bcrypt.compare(password, admin.password_hash);
        } else {
            const { error: authErr } = await insforge.auth.signInWithPassword({
                email: email.toLowerCase(),
                password
            });
            if (!authErr) validPassword = true;
        }

        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Issue JWT
        const token = jwt.sign(
            { role: 'admin', admin_id: admin.id },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        return res.json({
            token,
            admin: { id: admin.id, name: admin.name, email: admin.email, mobile: admin.mobile },
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
            .from('users')
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
            .from('users')
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
