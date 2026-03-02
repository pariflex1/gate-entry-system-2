const jwt = require('jsonwebtoken');
const insforge = require('../services/insforge');

/**
 * JWT Authentication Middleware
 * Verifies the token, extracts role, user ID, and society_id.
 * CRITICAL: society_id is ALWAYS read from the JWT, never from req.body.
 */
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        req.society_id = decoded.society_id;
        req.role = decoded.role;
        req.guard_id = decoded.guard_id || null;
        req.admin_id = decoded.admin_id || null;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        return res.status(401).json({ error: 'Invalid token' });
    }
}

/**
 * Guard-only middleware — must be used AFTER authenticate
 */
function guardOnly(req, res, next) {
    if (req.role !== 'guard') {
        return res.status(403).json({ error: 'Guard access required' });
    }
    next();
}

/**
 * Admin-only middleware — must be used AFTER authenticate
 */
function adminOnly(req, res, next) {
    if (req.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

/**
 * Check if the society is active (not suspended)
 * Must be used AFTER authenticate
 */
async function checkSocietyActive(req, res, next) {
    try {
        const { data, error } = await insforge.database
            .from('societies')
            .select('status')
            .eq('id', req.society_id)
            .single();

        if (error || !data) {
            return res.status(403).json({ error: 'Society not found' });
        }
        if (data.status === 'suspended') {
            return res.status(403).json({ error: 'Your society has been suspended. Contact support.' });
        }
        if (data.status !== 'active') {
            return res.status(403).json({ error: 'Society is not active' });
        }
        next();
    } catch (err) {
        return res.status(500).json({ error: 'Failed to verify society status' });
    }
}

module.exports = { authenticate, guardOnly, adminOnly, checkSocietyActive };
