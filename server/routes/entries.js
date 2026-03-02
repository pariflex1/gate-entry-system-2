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

        // Dedup check for offline sync: skip if same person + entry_time within 60 seconds
        if (entry_time) {
            const entryDate = new Date(entry_time);
            const minTime = new Date(entryDate.getTime() - 60000).toISOString();
            const maxTime = new Date(entryDate.getTime() + 60000).toISOString();

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
                .select('name')
                .eq('id', person_id)
                .single();

            const ownerMobile = unitData?.owner_mobile;
            if (ownerMobile || process.env.SUPERADMIN_WHATSAPP) {
                const phone = ownerMobile ? `91${ownerMobile}` : process.env.SUPERADMIN_WHATSAPP;
                const text = encodeURIComponent(
                    `Visitor Entry Alert\nName: ${person?.name || 'Unknown'}\nUnit: ${unit}\nPurpose: ${purpose || 'N/A'}`
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
                .select('id, name, mobile')
                .in('id', personIds);
            persons = data || [];
        }

        const personMap = {};
        for (const p of persons) personMap[p.id] = p;

        const result = insideEntries.map(e => ({
            ...e,
            person_name: personMap[e.person_id]?.name || 'Unknown',
            person_mobile: personMap[e.person_id]?.mobile || '',
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
                .select('id, name, mobile')
                .in('id', personIds);
            persons = data || [];
        }

        const personMap = {};
        for (const p of persons) personMap[p.id] = p;

        const result = (entries || []).map(e => ({
            ...e,
            person_name: personMap[e.person_id]?.name || 'Unknown',
            person_mobile: personMap[e.person_id]?.mobile || '',
        }));

        return res.json(result);
    } catch (error) {
        console.error('History error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
