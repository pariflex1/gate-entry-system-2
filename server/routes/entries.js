const express = require('express');
const insforge = require('../services/insforge');
const { authenticate, guardOnly, checkSocietyActive } = require('../middleware/auth');

const router = express.Router();

// All entry routes require guard auth
router.use(authenticate, guardOnly, checkSocietyActive);

/**
 * POST /api/entries
 * Body: { person_id, unit, purpose, vehicle_id, entry_type, entry_method }
 */
router.post('/', async (req, res) => {
    try {
        const { person_id, unit, purpose, vehicle_id, entry_type, entry_method, entry_time, synced_at } = req.body;

        if (!person_id || !entry_type || !entry_method) {
            return res.status(400).json({ error: 'person_id, entry_type, and entry_method are required' });
        }

        if (!['IN', 'OUT'].includes(entry_type)) {
            return res.status(400).json({ error: 'entry_type must be IN or OUT' });
        }
        if (!['QR', 'MOBILE'].includes(entry_method)) {
            return res.status(400).json({ error: 'entry_method must be QR or MOBILE' });
        }

        // Dedup check for offline sync: skip if same person + entry_time within 5 seconds
        if (entry_time) {
            const entryDate = new Date(entry_time);
            const minTime = new Date(entryDate.getTime() - 5000).toISOString();
            const maxTime = new Date(entryDate.getTime() + 5000).toISOString();

            const { data: existing } = await insforge.database
                .from('gate_entries')
                .select('id')
                .eq('society_id', req.society_id)
                .eq('person_id', person_id)
                .gte('entry_time', minTime)
                .lte('entry_time', maxTime)
                .limit(1);

            if (existing && existing.length > 0) {
                return res.status(409).json({ error: 'Duplicate entry detected', existing_id: existing[0].id });
            }
        }

        const entryData = {
            society_id: req.society_id,
            person_id,
            unit: unit || null,
            purpose: purpose || null,
            vehicle_id: vehicle_id || null,
            entry_type,
            entry_method,
            guard_id: req.guard_id,
        };

        // If this is an offline-synced entry, use the original entry_time and set synced_at
        if (entry_time) {
            entryData.entry_time = entry_time;
            entryData.synced_at = synced_at || new Date().toISOString();
        }

        // Check if person is already inside if they are attempting an 'IN' entry
        if (entry_type === 'IN') {
            const { data: latestEntry } = await insforge.database
                .from('gate_entries')
                .select('entry_type')
                .eq('society_id', req.society_id)
                .eq('person_id', person_id)
                .order('entry_time', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (latestEntry && latestEntry.entry_type === 'IN') {
                return res.status(409).json({ error: 'Person is already inside' });
            }
        }

        const { data: entry, error } = await insforge.database
            .from('gate_entries')
            .insert(entryData)
            .select()
            .single();

        if (error) {
            console.error('Entry insert error:', error);
            return res.status(500).json({ error: 'Failed to create entry' });
        }

        // Log guard activity
        const action = entry_type === 'IN' ? 'ENTRY_IN' : 'ENTRY_OUT';
        await insforge.database.from('guard_activity').insert({
            society_id: req.society_id,
            guard_id: req.guard_id,
            action,
            detail: `Person ${person_id}, Unit: ${unit || 'N/A'}, Method: ${entry_method}`,
        });

        // Fetch unit owner for WhatsApp link
        let whatsappLink = null;
        if (unit) {
            const { data: unitData } = await insforge.database
                .from('units')
                .select('owner_mobile')
                .eq('society_id', req.society_id)
                .eq('unit_number', unit)
                .maybeSingle();

            const { data: person } = await insforge.database
                .from('known_persons')
                .select('name, person_photo_url')
                .eq('id', person_id)
                .single();

            // Fetch vehicle number if vehicle_id is present
            let vehicleNumber = null;
            if (vehicle_id) {
                const { data: vehicle } = await insforge.database
                    .from('person_vehicles')
                    .select('vehicle_number')
                    .eq('id', vehicle_id)
                    .maybeSingle();
                vehicleNumber = vehicle?.vehicle_number || null;
            }

            const ownerMobile = unitData?.owner_mobile;
            let phone = null;
            if (ownerMobile) {
                phone = `91${ownerMobile}`;
            } else {
                // Fallback: use admin's default mobile from society settings
                const { data: societyInfo } = await insforge.database
                    .from('societies')
                    .select('admin_mobile')
                    .eq('id', req.society_id)
                    .maybeSingle();

                if (societyInfo?.admin_mobile) {
                    phone = `91${societyInfo.admin_mobile}`;
                } else if (process.env.SUPERADMIN_WHATSAPP) {
                    // Last resort fallback
                    phone = process.env.SUPERADMIN_WHATSAPP.replace(/\D/g, '');
                }
            }

            if (phone) {
                const photoText = person?.person_photo_url ? `\nPhoto: ${person.person_photo_url}` : '';
                const vehicleText = vehicleNumber ? `\nVehicle: ${vehicleNumber}` : '';
                const text = encodeURIComponent(
                    `Visitor Entry Alert\nName: ${person?.name || 'Unknown'}\nUnit: ${unit}\nPurpose: ${purpose || 'N/A'}${vehicleText}${photoText}`
                );
                whatsappLink = `https://wa.me/${phone}?text=${text}`;
            }
        }

        return res.status(201).json({ entry, whatsappLink });
    } catch (error) {
        console.error('Create entry error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/entries/inside
 * Returns all open IN entries (no matching OUT)
 */
router.get('/inside', async (req, res) => {
    try {
        // Get all entries for today, then compute "currently inside"
        const { data: entries, error } = await insforge.database
            .from('gate_entries')
            .select('id, person_id, unit, purpose, vehicle_id, entry_type, entry_method, entry_time, guard_id')
            .eq('society_id', req.society_id)
            .order('entry_time', { ascending: false });

        if (error) {
            return res.status(500).json({ error: 'Failed to fetch entries' });
        }

        // Compute currently inside: person is "inside" if their latest entry is IN
        const latestByPerson = {};
        for (const entry of entries) {
            if (!latestByPerson[entry.person_id]) {
                latestByPerson[entry.person_id] = entry;
            }
        }

        const insideEntries = Object.values(latestByPerson).filter(e => e.entry_type === 'IN');

        // Fetch person names for each inside entry
        const personIds = insideEntries.map(e => e.person_id);
        let persons = [];
        if (personIds.length > 0) {
            const { data } = await insforge.database
                .from('known_persons')
                .select('id, name, mobile, person_photo_url')
                .in('id', personIds);
            persons = data || [];
        }

        const vehicleIds = insideEntries.map(e => e.vehicle_id).filter(Boolean);
        let vehicles = [];
        if (vehicleIds.length > 0) {
            const { data } = await insforge.database
                .from('person_vehicles')
                .select('id, vehicle_number, vehicle_photo_url')
                .in('id', vehicleIds);
            vehicles = data || [];
        }

        // Fetch guard names
        const guardIds = [...new Set(insideEntries.map(e => e.guard_id))].filter(Boolean);
        let guards = [];
        if (guardIds.length > 0) {
            const { data } = await insforge.database
                .from('guards')
                .select('id, name')
                .in('id', guardIds);
            guards = data || [];
        }

        const personMap = {};
        for (const p of persons) personMap[p.id] = p;

        const vehicleMap = {};
        for (const v of vehicles) vehicleMap[v.id] = v;

        const guardMap = {};
        for (const g of guards) guardMap[g.id] = g;

        const result = insideEntries.map(e => ({
            ...e,
            person_name: personMap[e.person_id]?.name || 'Unknown',
            person_mobile: personMap[e.person_id]?.mobile || '',
            person_photo_url: personMap[e.person_id]?.person_photo_url || null,
            vehicle_photo_url: e.vehicle_id ? vehicleMap[e.vehicle_id]?.vehicle_photo_url || null : null,
            vehicle_number: e.vehicle_id ? vehicleMap[e.vehicle_id]?.vehicle_number || null : null,
            guard_name: e.guard_id ? guardMap[e.guard_id]?.name || 'Unknown Guard' : 'Unknown Guard',
        }));

        return res.json(result);
    } catch (error) {
        console.error('Currently inside error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/entries/history?hours=8
 * Returns entries within the last N hours
 */
router.get('/history', async (req, res) => {
    try {
        const hours = parseInt(req.query.hours) || 8;
        const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

        const { data: entries, error } = await insforge.database
            .from('gate_entries')
            .select('id, person_id, unit, purpose, vehicle_id, entry_type, entry_method, entry_time, guard_id, synced_at')
            .eq('society_id', req.society_id)
            .gte('entry_time', since)
            .order('entry_time', { ascending: false });

        if (error) {
            return res.status(500).json({ error: 'Failed to fetch history' });
        }

        // Fetch person names
        const personIds = [...new Set((entries || []).map(e => e.person_id))];
        let persons = [];
        if (personIds.length > 0) {
            const { data } = await insforge.database
                .from('known_persons')
                .select('id, name, mobile, person_photo_url')
                .in('id', personIds);
            persons = data || [];
        }

        // Fetch vehicle photos
        const vehicleIds = (entries || []).map(e => e.vehicle_id).filter(Boolean);
        let vehicles = [];
        if (vehicleIds.length > 0) {
            const { data } = await insforge.database
                .from('person_vehicles')
                .select('id, vehicle_number, vehicle_photo_url')
                .in('id', vehicleIds);
            vehicles = data || [];
        }

        // Fetch guard names
        const guardIds = [...new Set((entries || []).map(e => e.guard_id))];
        let guards = [];
        if (guardIds.length > 0) {
            const { data } = await insforge.database
                .from('guards')
                .select('id, name')
                .in('id', guardIds);
            guards = data || [];
        }

        const personMap = {};
        for (const p of persons) personMap[p.id] = p;

        const vehicleMap = {};
        for (const v of vehicles) vehicleMap[v.id] = v;

        const guardMap = {};
        for (const g of guards) guardMap[g.id] = g;

        const result = (entries || []).map(e => ({
            ...e,
            person_name: personMap[e.person_id]?.name || 'Unknown',
            person_mobile: personMap[e.person_id]?.mobile || '',
            person_photo_url: personMap[e.person_id]?.person_photo_url || null,
            vehicle_photo_url: e.vehicle_id ? vehicleMap[e.vehicle_id]?.vehicle_photo_url || null : null,
            vehicle_number: e.vehicle_id ? vehicleMap[e.vehicle_id]?.vehicle_number || null : null,
            guard_name: guardMap[e.guard_id]?.name || 'Unknown Guard',
        }));

        return res.json(result);
    } catch (error) {
        console.error('History error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
