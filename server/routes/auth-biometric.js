const express = require('express');
const jwt = require('jsonwebtoken');
const {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} = require('@simplewebauthn/server');
const insforge = require('../services/insforge');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// WebAuthn config defaults
const defaultRpName = 'Gate Entry System';
const envRpID = process.env.WEBAUTHN_RP_ID || 'localhost';
const envOrigin = process.env.WEBAUTHN_ORIGIN || `https://${envRpID}`;

// Allowed origins and RP IDs for local testing and prod
const allowedOrigins = [envOrigin, 'http://localhost:5173', 'http://localhost:30933', 'http://localhost:3000'];
const allowedRPIDs = [envRpID, 'localhost', 'entry.insforge.site', 'p4u6sjqt.ap-southeast.insforge.app', 'p4u6sjqt.insforge.site'];

// In-memory challenge store (per-session, short-lived)
const challengeStore = new Map();

// Clean up old challenges every 5 minutes
setInterval(() => {
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    for (const [key, val] of challengeStore) {
        if (val.createdAt < fiveMinAgo) challengeStore.delete(key);
    }
}, 5 * 60 * 1000);

const getOrigin = (req) => {
    const origin = req.get('origin');
    if (origin && allowedOrigins.includes(origin)) return origin;
    if (origin && origin.includes('localhost')) return origin; // Allow any localhost port
    if (origin && origin.includes('insforge')) return origin; // Allow any insforge domains
    return envOrigin;
};

const getRpID = (req) => {
    let host = req.get('host');
    if (host) {
        host = host.split(':')[0]; // Remove port
        if (allowedRPIDs.includes(host) || host === 'localhost' || host.includes('insforge')) {
            return host;
        }
    }
    return envRpID;
};

/**
 * POST /api/auth/biometric/register-options
 * Generates registration options for a logged-in user
 * Requires auth token
 */
router.post('/register-options', authenticate, async (req, res) => {
    try {
        const userId = req.admin_id || req.guard_id;
        const userType = req.role === 'admin' ? 'admin' : 'guard';
        const { deviceName } = req.body;

        if (!userId) return res.status(400).json({ error: 'User ID not found in session' });

        // Get existing passkeys for exclusion
        const { data: existingKeys } = await insforge.database
            .from('passkeys')
            .select('credential_id, transports')
            .eq('user_id', userId)
            .eq('user_type', userType);

        const excludeCredentials = (existingKeys || []).map(k => ({
            id: k.credential_id,
            type: 'public-key',
            transports: k.transports || [],
        }));

        // Generate a stable webauthn user id
        const webauthnUserId = Buffer.from(userId).toString('base64url');

        const options = await generateRegistrationOptions({
            rpName: defaultRpName,
            rpID: getRpID(req),
            userName: req.user?.email || userId,
            userDisplayName: req.user?.name || req.user?.email || 'User',
            userID: webauthnUserId,
            attestationType: 'none',
            excludeCredentials,
            authenticatorSelection: {
                residentKey: 'preferred',
                userVerification: 'preferred',
            },
        });

        // Store challenge
        challengeStore.set(`reg_${userId}`, {
            challenge: options.challenge,
            webauthnUserId,
            userType,
            deviceName: deviceName || 'My Device',
            createdAt: Date.now(),
        });

        return res.json(options);
    } catch (error) {
        console.error('Register options error:', error);
        return res.status(500).json({ error: 'Failed to generate registration options' });
    }
});

/**
 * POST /api/auth/biometric/register-verify
 * Verifies the registration response and stores the credential
 */
router.post('/register-verify', authenticate, async (req, res) => {
    try {
        const userId = req.admin_id || req.guard_id;
        if (!userId) return res.status(400).json({ error: 'User ID not found' });

        const stored = challengeStore.get(`reg_${userId}`);
        if (!stored) return res.status(400).json({ error: 'No registration challenge found. Please try again.' });

        const verification = await verifyRegistrationResponse({
            response: req.body,
            expectedChallenge: stored.challenge,
            expectedOrigin: getOrigin(req),
            expectedRPID: getRpID(req),
        });

        if (!verification.verified || !verification.registrationInfo) {
            return res.status(400).json({ error: 'Registration verification failed' });
        }

        const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

        // Store the credential
        const { error: insertError } = await insforge.database
            .from('passkeys')
            .insert({
                user_id: userId, // Keep user_id for backward compatibility
                admin_id: stored.userType === 'admin' ? userId : null,
                guard_id: stored.userType === 'guard' ? userId : null,
                user_type: stored.userType,
                webauthn_user_id: stored.webauthnUserId,
                credential_id: credential.id,
                public_key: Buffer.from(credential.publicKey).toString('base64'),
                counter: credential.counter,
                transports: req.body.response?.transports || [],
                device_name: stored.deviceName,
            });

        if (insertError) {
            console.error('Passkey insert error:', insertError);
            return res.status(500).json({ error: 'Failed to save passkey' });
        }

        challengeStore.delete(`reg_${userId}`);

        return res.json({ verified: true, message: 'Biometric registered successfully' });
    } catch (error) {
        console.error('Register verify error:', error);
        return res.status(500).json({ error: 'Registration verification failed' });
    }
});

/**
 * POST /api/auth/biometric/login-options
 * Generates authentication options (no auth required)
 * Body: { userType: 'admin' | 'guard', email?: string, society_slug?: string }
 */
router.post('/login-options', async (req, res) => {
    try {
        const { userType, email, society_slug } = req.body;
        if (!userType) return res.status(400).json({ error: 'userType is required' });

        // Generate session ID for this auth attempt
        const sessionId = `auth_${Date.now()}_${Math.random().toString(36).slice(2)}`;

        const options = await generateAuthenticationOptions({
            rpID: getRpID(req),
            userVerification: 'preferred',
        });

        challengeStore.set(sessionId, {
            challenge: options.challenge,
            userType,
            email,
            society_slug,
            createdAt: Date.now(),
        });

        return res.json({ ...options, sessionId });
    } catch (error) {
        console.error('Login options error:', error);
        return res.status(500).json({ error: 'Failed to generate authentication options' });
    }
});

/**
 * POST /api/auth/biometric/login-verify
 * Verifies the authentication response and returns JWT
 */
router.post('/login-verify', async (req, res) => {
    try {
        const { sessionId, ...authResponse } = req.body;
        if (!sessionId) return res.status(400).json({ error: 'Session ID is required' });

        const stored = challengeStore.get(sessionId);
        if (!stored) return res.status(400).json({ error: 'Authentication session expired. Please try again.' });

        // Find the credential
        const credentialId = authResponse.id;
        const { data: passkey } = await insforge.database
            .from('passkeys')
            .select('*')
            .eq('credential_id', credentialId)
            .eq('user_type', stored.userType)
            .maybeSingle();

        if (!passkey) {
            return res.status(404).json({ error: 'Passkey not found. Please register your biometric first.' });
        }

        const verification = await verifyAuthenticationResponse({
            response: authResponse,
            expectedChallenge: stored.challenge,
            expectedOrigin: getOrigin(req),
            expectedRPID: getRpID(req),
            credential: {
                id: passkey.credential_id,
                publicKey: Buffer.from(passkey.public_key, 'base64'),
                counter: passkey.counter,
                transports: passkey.transports || [],
            },
        });

        if (!verification.verified) {
            return res.status(400).json({ error: 'Biometric verification failed' });
        }

        // Update counter
        await insforge.database
            .from('passkeys')
            .update({ counter: verification.authenticationInfo.newCounter })
            .eq('id', passkey.id);

        challengeStore.delete(sessionId);

        // Now generate a JWT for the verified user
        if (stored.userType === 'admin') {
            // Fetch admin societies
            const authUserId = passkey.admin_id || passkey.user_id;
            const { data: societies } = await insforge.database
                .from('societies')
                .select('*')
                .eq('auth_user_id', authUserId)
                .order('created_at', { ascending: false });

            const token = jwt.sign(
                { role: 'admin', admin_id: authUserId },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            return res.json({
                token,
                admin: { id: authUserId },
                societies: societies || [],
            });
        } else {
            // Guard login — look up guard info
            const g_id = passkey.guard_id || passkey.user_id;
            const { data: guard } = await insforge.database
                .from('guards')
                .select('id, name, mobile, society_id, active')
                .eq('id', g_id)
                .maybeSingle();

            if (!guard) return res.status(404).json({ error: 'Guard not found' });
            if (!guard.active) return res.status(403).json({ error: 'Guard account is deactivated' });

            const token = jwt.sign(
                { role: 'guard', guard_id: guard.id, society_id: guard.society_id },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            return res.json({
                token,
                guard: { id: guard.id, name: guard.name, mobile: guard.mobile },
                society_id: guard.society_id,
            });
        }
    } catch (error) {
        console.error('Login verify error:', error);
        return res.status(500).json({ error: 'Biometric login failed' });
    }
});

/**
 * GET /api/auth/biometric/passkeys
 * List passkeys for the authenticated user
 */
router.get('/passkeys', authenticate, async (req, res) => {
    try {
        const userId = req.admin_id || req.guard_id;
        const userType = req.role === 'admin' ? 'admin' : 'guard';

        const { data, error } = await insforge.database
            .from('passkeys')
            .select('id, device_name, created_at')
            .or(`admin_id.eq.${userId},guard_id.eq.${userId},user_id.eq.${userId}`)
            .eq('user_type', userType)
            .order('created_at', { ascending: false });

        if (error) return res.status(500).json({ error: 'Failed to fetch passkeys' });

        return res.json(data || []);
    } catch (error) {
        console.error('List passkeys error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/auth/biometric/passkeys/:id
 * Remove a passkey
 */
router.delete('/passkeys/:id', authenticate, async (req, res) => {
    try {
        const userId = req.admin_id || req.guard_id;
        const userType = req.role === 'admin' ? 'admin' : 'guard';

        const { error } = await insforge.database
            .from('passkeys')
            .delete()
            .eq('id', req.params.id)
            .eq('user_id', userId)
            .eq('user_type', userType);

        if (error) return res.status(500).json({ error: 'Failed to delete passkey' });

        return res.json({ message: 'Passkey removed' });
    } catch (error) {
        console.error('Delete passkey error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
