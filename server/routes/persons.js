const express = require('express');
const insforge = require('../services/insforge');
const { authenticate, checkSocietyActive } = require('../middleware/auth');

const router = express.Router();

// All person routes require auth
router.use(authenticate, checkSocietyActive);

/**
 * GET /api/persons/search?mobile=xxx
 * Search known_persons by mobile within society scope
 */
router.get('/search', async (req, res) => {
    try {
        const { mobile } = req.query;
        if (!mobile) {
            return res.status(400).json({ error: 'mobile query parameter is required' });
        }

        const { data: person, error } = await insforge.database
            .from('known_persons')
            .select('*')
            .eq('society_id', req.society_id)
            .eq('mobile', mobile)
            .maybeSingle();

        if (error) {
            return res.status(500).json({ error: 'Search failed' });
        }

        if (!person) {
            return res.json({ found: false, person: null, vehicles: [] });
        }

        // Fetch vehicles for this person
        const { data: vehicles } = await insforge.database
            .from('person_vehicles')
            .select('*')
            .eq('person_id', person.id)
            .eq('society_id', req.society_id)
            .order('created_at', { ascending: false });

        return res.json({ found: true, person, vehicles: vehicles || [] });
    } catch (error) {
        console.error('Person search error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/persons/search-qr?code=xxx
 * Search by QR code within society scope
 */
router.get('/search-qr', async (req, res) => {
    try {
        const { code } = req.query;
        if (!code) {
            return res.status(400).json({ error: 'code query parameter is required' });
        }

        // Find the QR code
        const { data: qr, error: qrErr } = await insforge.database
            .from('qr_codes')
            .select('*')
            .eq('qr_code', code)
            .eq('society_id', req.society_id)
            .maybeSingle();

        if (qrErr) {
            return res.status(500).json({ error: 'QR search failed' });
        }

        if (!qr) {
            return res.json({ found: false, qr_status: 'unknown', error: 'QR code not found in this society. Contact admin.' });
        }

        if (qr.status === 'free') {
            return res.json({ found: false, qr_status: 'free', qr_code: qr.qr_code });
        }

        if (qr.status === 'inactive') {
            return res.json({ found: false, qr_status: 'inactive', error: 'This QR code has been deactivated.' });
        }

        // QR is assigned — fetch person
        if (qr.assigned_person_id) {
            const { data: person } = await insforge.database
                .from('known_persons')
                .select('*')
                .eq('id', qr.assigned_person_id)
                .single();

            const { data: vehicles } = await insforge.database
                .from('person_vehicles')
                .select('*')
                .eq('person_id', qr.assigned_person_id)
                .eq('society_id', req.society_id)
                .order('created_at', { ascending: false });

            return res.json({ found: true, qr_status: 'assigned', person, vehicles: vehicles || [] });
        }

        return res.json({ found: false, qr_status: qr.status });
    } catch (error) {
        console.error('QR search error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/persons
 * Upsert a person — ON CONFLICT (society_id, mobile) update name/unit
 * Body: { name, mobile, unit }
 */
router.post('/', async (req, res) => {
    try {
        const { name, mobile, unit } = req.body;
        if (!name || !mobile) {
            return res.status(400).json({ error: 'name and mobile are required' });
        }

        // Check if exists
        const { data: existing } = await insforge.database
            .from('known_persons')
            .select('*')
            .eq('society_id', req.society_id)
            .eq('mobile', mobile)
            .maybeSingle();

        if (existing) {
            // Update
            const { data: updated, error } = await insforge.database
                .from('known_persons')
                .update({ name, unit: unit || existing.unit })
                .eq('id', existing.id)
                .select()
                .single();

            if (error) {
                return res.status(500).json({ error: 'Failed to update person' });
            }
            return res.json({ person: updated, created: false });
        }

        // Insert new
        const { data: person, error } = await insforge.database
            .from('known_persons')
            .insert({
                society_id: req.society_id,
                name,
                mobile,
                unit: unit || null,
            })
            .select()
            .single();

        if (error) {
            console.error('Person insert error:', error);
            return res.status(500).json({ error: 'Failed to create person' });
        }

        return res.status(201).json({ person, created: true });
    } catch (error) {
        console.error('Upsert person error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/persons/:id/vehicles
 * Get all vehicles for a person
 */
router.get('/:id/vehicles', async (req, res) => {
    try {
        const { data: vehicles, error } = await insforge.database
            .from('person_vehicles')
            .select('*')
            .eq('person_id', req.params.id)
            .eq('society_id', req.society_id)
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ error: 'Failed to fetch vehicles' });
        }

        return res.json(vehicles || []);
    } catch (error) {
        console.error('Get vehicles error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/persons/:id/vehicles
 * Add a vehicle to a person
 * Body: { vehicle_number }
 */
router.post('/:id/vehicles', async (req, res) => {
    try {
        const { vehicle_number } = req.body;
        if (!vehicle_number) {
            return res.status(400).json({ error: 'vehicle_number is required' });
        }

        // Validate format
        const formatRegex = /^[A-Z]{2}-[0-9]{2}-[A-Z]{2}-[0-9]{4}$/;
        if (!formatRegex.test(vehicle_number)) {
            return res.status(400).json({ error: 'Vehicle number format must be AA-00-AA-0000 (e.g. MH-12-AB-1234)' });
        }

        // Check for duplicate within society
        const { data: existing } = await insforge.database
            .from('person_vehicles')
            .select('id, person_id')
            .eq('society_id', req.society_id)
            .eq('vehicle_number', vehicle_number)
            .maybeSingle();

        if (existing) {
            if (existing.person_id === req.params.id) {
                // Same person — just return the existing vehicle
                return res.json({ vehicle: existing, duplicate: 'same_person' });
            } else {
                // Different person — get name for warning
                const { data: otherPerson } = await insforge.database
                    .from('known_persons')
                    .select('name')
                    .eq('id', existing.person_id)
                    .single();

                return res.status(409).json({
                    error: `${vehicle_number} is registered to ${otherPerson?.name || 'another person'}. Link or cancel?`,
                    duplicate: 'different_person',
                    existing_person_name: otherPerson?.name || 'Unknown',
                    existing_vehicle_id: existing.id,
                });
            }
        }

        // Insert new vehicle
        const { data: vehicle, error } = await insforge.database
            .from('person_vehicles')
            .insert({
                society_id: req.society_id,
                person_id: req.params.id,
                vehicle_number,
            })
            .select()
            .single();

        if (error) {
            console.error('Vehicle insert error:', error);
            return res.status(500).json({ error: 'Failed to add vehicle' });
        }

        return res.status(201).json({ vehicle, duplicate: null });
    } catch (error) {
        console.error('Add vehicle error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
