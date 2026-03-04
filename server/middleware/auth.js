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
        req.role = decoded.role;
        req.guard_id = decoded.guard_id || null;
        req.admin_id = decoded.admin_id || null;

        // society_id can come from JWT (guards) or header (admins)
        req.society_id = decoded.society_id || req.headers['x-society-id'];

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
    if (!req.society_id) {
        return res.status(400).json({ error: 'Society ID missing from session' });
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
        if (!req.society_id) {
            // If no society_id, we can only check user status
            if (req.admin_id) {
                const { data: user } = await insforge.database
                    .from('users')
                    .select('status')
                    .eq('id', req.admin_id)
                    .single();
                if (!user || user.status !== 'active') {
                    return res.status(403).json({ error: 'User account is not active' });
                }
                return next();
            }
            return res.status(400).json({ error: 'Society selection required' });
        }

        const { data: society, error } = await insforge.database
            .from('societies')
            .select('status, admin_id')
            .eq('id', req.society_id)
            .single();

        if (error || !society) {
            return res.status(403).json({ error: 'Society not found' });
        }

        // Security Check: If admin, verify ownership
        if (req.role === 'admin' && society.admin_id !== req.admin_id) {
            return res.status(403).json({ error: 'Permission denied: You do not own this society' });
        }

        if (society.status !== 'active') {
            return res.status(403).json({ error: 'Society is not active' });
        }

        // Also check owner status
        const { data: user } = await insforge.database
            .from('users')
            .select('status')
            .eq('id', society.admin_id)
            .single();

        if (!user || user.status !== 'active') {
            return res.status(403).json({ error: 'Society owner is not active' });
        }

        next();
    } catch (err) {
        console.error('Check society active error:', err);
        return res.status(500).json({ error: 'Failed to verify status' });
    }
}

/**
 * Force society selection — must be used AFTER authenticate
 */
function societyRequired(req, res, next) {
    if (!req.society_id) {
        return res.status(400).json({ error: 'Society selection required. Please select a society from the top menu.' });
    }
    next();
}

module.exports = { authenticate, guardOnly, adminOnly, checkSocietyActive, societyRequired };
