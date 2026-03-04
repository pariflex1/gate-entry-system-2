require('dotenv').config({ path: __dirname + '/.env' });

const express = require('express');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('./routes/auth');
const entriesRoutes = require('./routes/entries');
const personsRoutes = require('./routes/persons');
const uploadRoutes = require('./routes/upload');
const adminRoutes = require('./routes/admin');
const qrRoutes = require('./routes/qr');
const { authenticate, checkSocietyActive } = require('./middleware/auth');
const insforge = require('./services/insforge');

const app = express();
const PORT = process.env.PORT || 5000;

// ============ MIDDLEWARE ============

// Security headers (configured for SPA frontends)
app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP — React apps load inline scripts/styles
    crossOriginEmbedderPolicy: false,
}));

// CORS — allow requests from frontend domains
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);
        // Allow all jhansiproperty.com subdomains + localhost
        const allowed = [
            /\.jhansiproperty\.com$/,
            /^https?:\/\/localhost/,
            /^https?:\/\/127\.0\.0\.1/,
            /^https?:\/\/entry\.jhansiproperty\.com/,
        ];
        const isAllowed = allowed.some(pattern => pattern.test(origin));
        if (isAllowed) {
            callback(null, true);
        } else {
            callback(null, true); // Allow all in development; restrict in production
        }
    },
    credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============ ROUTES ============

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public routes (no auth)
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/entries', entriesRoutes);
app.use('/api/persons', personsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/qr', qrRoutes);

// Public endpoint: Get units for a society by slug (for guard app dropdown)
app.get('/api/units/:slug', async (req, res) => {
    try {
        const { data: society } = await insforge.database
            .from('societies')
            .select('id')
            .eq('slug', req.params.slug)
            .single();

        if (!society) {
            return res.status(404).json({ error: 'Society not found' });
        }

        const { data: units } = await insforge.database
            .from('units')
            .select('id, unit_number, owner_name')
            .eq('society_id', society.id)
            .order('unit_number', { ascending: true });

        return res.json(units || []);
    } catch (error) {
        console.error('Get units error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Get app settings (public — only non-sensitive settings)
app.get('/api/settings', async (req, res) => {
    try {
        const { data } = await insforge.database
            .from('app_settings')
            .select('*');

        const settings = {};
        for (const row of (data || [])) {
            // Only expose non-sensitive settings
            if (!['superadmin_email', 'superadmin_whatsapp'].includes(row.key)) {
                settings[row.key] = row.value;
            }
        }

        return res.json(settings);
    } catch (error) {
        console.error('Get settings error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Lookup society by slug (for the guard app to identify the society)
app.get('/api/society/:slug', async (req, res) => {
    try {
        const { data: society, error } = await insforge.database
            .from('societies')
            .select('id, name, slug, status')
            .eq('slug', req.params.slug)
            .single();

        if (error || !society) {
            return res.status(404).json({ error: 'Society not found' });
        }

        return res.json({
            id: society.id,
            name: society.name,
            slug: society.slug,
            status: society.status,
        });
    } catch (error) {
        console.error('Society lookup error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ============ STATIC FILES (FRONTEND) ============
const path = require('path');
const distPath = path.join(__dirname, '..', 'dist');

if (fs.existsSync(distPath)) {
    // Serve static files from the dist folder
    app.use(express.static(distPath));

    // Handle Admin Portal (SPA)
    app.get(/^\/admin($|\/.*)/, (req, res) => {
        res.sendFile(path.join(distPath, 'admin', 'index.html'));
    });

    // Handle Guard Portal (SPA)
    app.get(/^\/client($|\/.*)/, (req, res) => {
        res.sendFile(path.join(distPath, 'client', 'index.html'));
    });

    // Fallback for root (portal selector)
    app.get(/^\/(?!api\/).*/, (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

// ============ ERROR HANDLING ============

// 404
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ============ START ============

app.listen(PORT, () => {
    console.log(`\n🚀 Gate Entry API Server running on port ${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/api/health`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;
