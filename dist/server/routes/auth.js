const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const insforge = require('../services/insforge');

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

        // 3. Check society status (no user_profile needed)
        const { data: society, error: socErr } = await insforge.database
            .from('societies')
            .select('id, slug, status')
            .eq('id', society_id)
            .single();

        if (socErr || !society) {
            return res.status(404).json({ error: 'Society not found' });
        }
        if (society.status === 'suspended') {
            return res.status(403).json({ error: 'This society has been suspended' });
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
 * Body: { email, password }
 * Simple signup — just email/password. Society is created after first login.
 */
router.post('/admin-register', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        // Create auth user via InsForge signUp
        const { data: authData, error: authErr } = await insforge.auth.signUp({
            email: email.toLowerCase(),
            password,
        });

        if (authErr) {
            if (authErr.message && authErr.message.includes('already registered')) {
                return res.status(409).json({ error: 'Email already registered' });
            }
            console.error('InsForge signUp error:', authErr);
            return res.status(500).json({ error: authErr.message || 'Failed to create account' });
        }

        return res.status(201).json({
            message: 'Registration successful! Please verify your email before logging in.',
        });
    } catch (error) {
        console.error('Admin register error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/auth/admin-login
 * Body: { email, password }
 * Returns auth user info + list of owned societies.
 */
router.post('/admin-login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Authenticate via InsForge
        const { data: authData, error: authErr } = await insforge.auth.signInWithPassword({
            email: email.toLowerCase(),
            password
        });

        if (authErr) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const authUserId = authData.user.id;
        const userEmail = authData.user.email;

        // Fetch all societies owned by this user
        const { data: societies } = await insforge.database
            .from('societies')
            .select('id, name, slug, address, status')
            .eq('auth_user_id', authUserId)
            .order('created_at', { ascending: false });

        // Issue JWT (admin_id = auth.users.id)
        const token = jwt.sign(
            { role: 'admin', admin_id: authUserId },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        return res.json({
            token,
            admin: { id: authUserId, email: userEmail },
            societies: societies || [],
        });
    } catch (error) {
        console.error('Admin login error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/auth/social-login
 * Body: { access_token }
 */
router.post('/social-login', async (req, res) => {
    try {
        const { access_token } = req.body;
        if (!access_token) return res.status(400).json({ error: 'Token missing' });

        // Get user from access token
        const { data: userData, error: userError } = await insforge.auth.getUser(access_token);
        if (userError || !userData || !userData.user) {
            return res.status(401).json({ error: 'Invalid social token' });
        }

        const userEmail = userData.user.email.toLowerCase();
        const authUserId = userData.user.id;

        // Fetch societies owned by this auth user
        const { data: societies } = await insforge.database
            .from('societies')
            .select('id, name, slug, address, status')
            .eq('auth_user_id', authUserId)
            .order('created_at', { ascending: false });

        // Issue our app JWT
        const token = jwt.sign(
            { role: 'admin', admin_id: authUserId },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        return res.json({
            token,
            admin: { id: authUserId, email: userEmail },
            societies: societies || [],
        });
    } catch (error) {
        console.error('Social login error:', error);
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

        await insforge.auth.sendResetPasswordEmail(email.toLowerCase(), {
            redirectTo: `${process.env.CLIENT_URL || 'http://localhost:5174/admin'}/reset-password`,
        });

        return res.json({ message: 'If an account exists with that email, a reset link has been sent.' });
    } catch (error) {
        console.error('Forgot password error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
