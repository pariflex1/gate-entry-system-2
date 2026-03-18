const express = require('express');
const bcrypt = require('bcrypt');
const insforge = require('../services/insforge');
const { authenticate, adminOnly, checkSocietyActive, societyRequired } = require('../middleware/auth');

const router = express.Router();

// All admin routes require admin auth
router.use(authenticate, adminOnly, checkSocietyActive);

// ============ SOCIETIES ============

/**
 * GET /api/admin/societies
 * List all societies owned by the authenticated admin
 */
router.get('/societies', async (req, res) => {
    try {
        const { data, error } = await insforge.database
            .from('societies')
            .select('*')
            .eq('auth_user_id', req.admin_id)
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ error: 'Failed to fetch societies' });
        }

        return res.json(data || []);
    } catch (error) {
        console.error('Admin societies error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/admin/societies
 * Create a new society
 * Body: { name, address }
 */
router.post('/societies', async (req, res) => {
    try {
        const { name, address } = req.body;
        if (!name) return res.status(400).json({ error: 'Society name is required' });

        // Generate slug
        const slug = name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

        // Check uniqueness
        const { data: existing } = await insforge.database
            .from('societies')
            .select('id')
            .eq('slug', slug)
            .maybeSingle();

        if (existing) {
            return res.status(409).json({ error: 'A society with a similar name already exists' });
        }

        const { data: society, error } = await insforge.database
            .from('societies')
            .insert({
                auth_user_id: req.admin_id,
                name,
                slug,
                address: address || null,
                status: 'active',
            })
            .select()
            .single();

        if (error) {
            console.error('Society insert error:', error);
            return res.status(500).json({ error: 'Failed to create society' });
        }

        return res.status(201).json(society);
    } catch (error) {
        console.error('Create society error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/admin/societies/:id
 */
router.put('/societies/:id', async (req, res) => {
    try {
        const { name, address, status } = req.body;
        const updateData = {};
        if (name) updateData.name = name;
        if (address !== undefined) updateData.address = address;
        if (status) updateData.status = status;

        const { data, error } = await insforge.database
            .from('societies')
            .update(updateData)
            .eq('id', req.params.id)
            .eq('auth_user_id', req.admin_id)
            .select()
            .single();

        if (error) {
            return res.status(500).json({ error: 'Failed to update society' });
        }

        return res.json(data);
    } catch (error) {
        console.error('Update society error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/admin/societies/:id
 */
router.delete('/societies/:id', async (req, res) => {
    try {
        const { error } = await insforge.database
            .from('societies')
            .delete()
            .eq('id', req.params.id)
            .eq('auth_user_id', req.admin_id);

        if (error) {
            return res.status(500).json({ error: 'Failed to delete society' });
        }

        return res.json({ message: 'Society deleted' });
    } catch (error) {
        console.error('Delete society error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ============ ACCOUNT SETTINGS ============

/**
 * GET /api/admin/account
 * Get current user info from auth
 */
router.get('/account', async (req, res) => {
    try {
        return res.json({ id: req.admin_id });
    } catch (error) {
        console.error('Get account error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Routes below this line REQUIRE a society to be selected
router.use(societyRequired);

/**
 * GET /api/admin/dashboard
 * Returns KPI stats for the society
 */
router.get('/dashboard', async (req, res) => {
    try {
        const sid = req.society_id;
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        // Entries today
        const { data: todayEntries } = await insforge.database
            .from('gate_entries')
            .select('id', { count: 'exact' })
            .eq('society_id', sid)
            .gte('entry_time', todayStart.toISOString());

        // Currently inside â€” get latest entry per person and filter for IN
        const { data: allEntries } = await insforge.database
            .from('gate_entries')
            .select('person_id, entry_type')
            .eq('society_id', sid)
            .order('entry_time', { ascending: false });

        const latestByPerson = {};
        for (const e of (allEntries || [])) {
            if (!latestByPerson[e.person_id]) latestByPerson[e.person_id] = e;
        }
        const currentlyInside = Object.values(latestByPerson).filter(e => e.entry_type === 'IN').length;

        // Active guards
        const { data: guards } = await insforge.database
            .from('guards')
            .select('id', { count: 'exact' })
            .eq('society_id', sid)
            .eq('active', true);

        // Free QR codes
        const { data: freeQR } = await insforge.database
            .from('qr_codes')
            .select('qr_code', { count: 'exact' })
            .eq('society_id', sid)
            .eq('status', 'free');

        return res.json({
            entriesToday: todayEntries?.length || 0,
            currentlyInside,
            activeGuards: guards?.length || 0,
            freeQRCodes: freeQR?.length || 0,
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ============ PERSONS ============

/**
 * GET /api/admin/persons?search=xxx&page=1&limit=20
 * Lists persons linked to this society via person_society_data
 */
router.get('/persons', async (req, res) => {
    try {
        const { search, page = 1, limit = 20 } = req.query;
        const from = (parseInt(page) - 1) * parseInt(limit);
        const to = from + parseInt(limit) - 1;

        // First get person_ids linked to this society
        const { data: societyLinks, error: linkError } = await insforge.database
            .from('person_society_data')
            .select('person_id, unit')
            ;

        if (linkError) {
            return res.status(500).json({ error: 'Failed to fetch persons' });
        }

        if (!societyLinks || societyLinks.length === 0) {
            return res.json({ persons: [], total: 0, page: parseInt(page), limit: parseInt(limit) });
        }

        const personIds = societyLinks.map(l => l.person_id);
        const unitMap = {};
        for (const l of societyLinks) {
            unitMap[l.person_id] = l.unit;
        }

        let query = insforge.database
            .from('known_persons')
            .select('*', { count: 'exact' })
            .in('id', personIds)
            .order('created_at', { ascending: false })
            .range(from, to);

        if (search) {
            query = query.ilike('mobile', `%${search}%`);
        }

        const { data, error, count } = await query;

        if (error) {
            return res.status(500).json({ error: 'Failed to fetch persons' });
        }

        // Merge unit from societyData
        const personsWithUnit = (data || []).map(p => ({
            ...p,
            unit: unitMap[p.id] || null,
        }));

        return res.json({ persons: personsWithUnit, total: count || 0, page: parseInt(page), limit: parseInt(limit) });
    } catch (error) {
        console.error('Admin persons error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/admin/persons/:id
 * Update a person's details
 * Global: name, qr_code, qr_status
 * Society-specific: unit
 */
router.put('/persons/:id', async (req, res) => {
    try {
        const { name, unit, qr_code, qr_status } = req.body;

        // Update global data
        const globalUpdate = {};
        if (name !== undefined) globalUpdate.name = name;
        if (qr_code !== undefined) globalUpdate.qr_code = qr_code;
        if (qr_status !== undefined) globalUpdate.qr_status = qr_status;

        if (Object.keys(globalUpdate).length > 0) {
            const { error } = await insforge.database
                .from('known_persons')
                .update(globalUpdate)
                .eq('id', req.params.id);

            if (error) {
                return res.status(500).json({ error: 'Failed to update person' });
            }
        }

        // Update society-specific data (unit)
        if (unit !== undefined) {
            const { data: existingLink } = await insforge.database
                .from('person_society_data')
                .select('id')
                .eq('person_id', req.params.id)
                .eq('society_id', req.society_id)
                .maybeSingle();

            if (existingLink) {
                await insforge.database
                    .from('person_society_data')
                    .update({ unit })
                    .eq('id', existingLink.id);
            } else {
                await insforge.database
                    .from('person_society_data')
                    .insert({
                        person_id: req.params.id,
                        society_id: req.society_id,
                        unit,
                    });
            }
        }

        // Fetch updated person
        const { data: updatedPerson } = await insforge.database
            .from('known_persons')
            .select('*')
            .eq('id', req.params.id)
            .single();

        const { data: societyData } = await insforge.database
            .from('person_society_data')
            .select('unit')
            .eq('person_id', req.params.id)
            .eq('society_id', req.society_id)
            .maybeSingle();

        return res.json({ ...updatedPerson, unit: societyData?.unit || null });
    } catch (error) {
        console.error('Update person error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ============ GUARDS ============

/**
 * GET /api/admin/guards
 */
router.get('/guards', async (req, res) => {
    try {
        const { data, error } = await insforge.database
            .from('guards')
            .select('id, name, mobile, active, created_at')
            .eq('society_id', req.society_id)
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ error: 'Failed to fetch guards' });
        }

        return res.json(data || []);
    } catch (error) {
        console.error('Admin guards error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/admin/guards
 * Body: { name, mobile, pin }
 */
router.post('/guards', async (req, res) => {
    try {
        const { name, mobile, pin } = req.body;
        if (!name || !mobile || !pin) {
            return res.status(400).json({ error: 'name, mobile, and pin are required' });
        }
        if (!/^\d{10}$/.test(mobile)) {
            return res.status(400).json({ error: 'Mobile must be a 10-digit number' });
        }
        if (!/^\d{4}$/.test(pin)) {
            return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
        }

        // Check uniqueness
        const { data: existing } = await insforge.database
            .from('guards')
            .select('id')
            .eq('society_id', req.society_id)
            .eq('mobile', mobile)
            .maybeSingle();

        if (existing) {
            return res.status(409).json({ error: 'A guard with this mobile number already exists' });
        }

        const pin_hash = await bcrypt.hash(pin, 12);

        const { data: guard, error } = await insforge.database
            .from('guards')
            .insert({
                society_id: req.society_id,
                name,
                mobile,
                pin_hash,
                active: true,
            })
            .select('id, name, mobile, active, created_at')
            .single();

        if (error) {
            console.error('Guard create error:', error);
            return res.status(500).json({ error: 'Failed to create guard' });
        }

        return res.status(201).json(guard);
    } catch (error) {
        console.error('Create guard error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/admin/guards/:id
 * Toggle active status
 */
router.put('/guards/:id', async (req, res) => {
    try {
        const { active, name, mobile } = req.body;
        const updateData = {};
        if (active !== undefined) updateData.active = active;
        if (name !== undefined) updateData.name = name;
        if (mobile !== undefined) updateData.mobile = mobile;

        const { data, error } = await insforge.database
            .from('guards')
            .update(updateData)
            .eq('id', req.params.id)
            .eq('society_id', req.society_id)
            .select('id, name, mobile, active, created_at')
            .single();

        if (error) {
            return res.status(500).json({ error: 'Failed to update guard' });
        }

        return res.json(data);
    } catch (error) {
        console.error('Update guard error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/admin/guards/:id/reset-pin
 * Body: { pin }
 */
router.put('/guards/:id/reset-pin', async (req, res) => {
    try {
        const { pin } = req.body;
        if (!pin || !/^\d{4}$/.test(pin)) {
            return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
        }

        const pin_hash = await bcrypt.hash(pin, 12);

        const { data, error } = await insforge.database
            .from('guards')
            .update({ pin_hash })
            .eq('id', req.params.id)
            .eq('society_id', req.society_id)
            .select('id, name, mobile')
            .single();

        if (error) {
            return res.status(500).json({ error: 'Failed to reset PIN' });
        }

        return res.json({ message: 'PIN reset successfully', guard: data });
    } catch (error) {
        console.error('Reset PIN error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/admin/guards/:id
 * Only if zero activity
 */
router.delete('/guards/:id', async (req, res) => {
    try {
        const guardId = req.params.id;

        // Check for activity
        const { data: activity } = await insforge.database
            .from('guard_activity')
            .select('id')
            .eq('guard_id', guardId)
            .limit(1);

        if (activity && activity.length > 0) {
            return res.status(400).json({ error: 'Cannot delete guard with recorded activity. Deactivate instead.' });
        }

        const { data: entries } = await insforge.database
            .from('gate_entries')
            .select('id')
            .eq('guard_id', guardId)
            .limit(1);

        if (entries && entries.length > 0) {
            return res.status(400).json({ error: 'Cannot delete guard with recorded entries. Deactivate instead.' });
        }

        const { error } = await insforge.database
            .from('guards')
            .delete()
            .eq('id', guardId)
            ;

        if (error) {
            return res.status(500).json({ error: 'Failed to delete guard' });
        }

        return res.json({ message: 'Guard deleted' });
    } catch (error) {
        console.error('Delete guard error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ============ UNITS ============

/**
 * GET /api/admin/units
 */
router.get('/units', async (req, res) => {
    try {
        const { data, error } = await insforge.database
            .from('units')
            .select('*')
            .eq('society_id', req.society_id)
            .order('unit_number', { ascending: true });

        if (error) {
            return res.status(500).json({ error: 'Failed to fetch units' });
        }

        return res.json(data || []);
    } catch (error) {
        console.error('Admin units error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/admin/units
 * Body: { unit_number, owner_name, owner_mobile }
 */
router.post('/units', async (req, res) => {
    try {
        const { unit_number, owner_name, owner_mobile } = req.body;
        if (!unit_number) {
            return res.status(400).json({ error: 'unit_number is required' });
        }

        const { data, error } = await insforge.database
            .from('units')
            .insert({
                society_id: req.society_id,
                unit_number,
                owner_name: owner_name || null,
                owner_mobile: owner_mobile || null,
            })
            .select()
            .single();

        if (error) {
            if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
                return res.status(409).json({ error: 'Unit number already exists' });
            }
            return res.status(500).json({ error: 'Failed to create unit' });
        }

        return res.status(201).json(data);
    } catch (error) {
        console.error('Create unit error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/admin/units/:id
 */
router.put('/units/:id', async (req, res) => {
    try {
        const { unit_number, owner_name, owner_mobile } = req.body;
        const updateData = {};
        if (unit_number !== undefined) updateData.unit_number = unit_number;
        if (owner_name !== undefined) updateData.owner_name = owner_name;
        if (owner_mobile !== undefined) updateData.owner_mobile = owner_mobile;

        const { data, error } = await insforge.database
            .from('units')
            .update(updateData)
            .eq('id', req.params.id)
            .select().single();

        if (error) {
            return res.status(500).json({ error: 'Failed to update unit' });
        }

        return res.json(data);
    } catch (error) {
        console.error('Update unit error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/admin/units/:id
 */
router.delete('/units/:id', async (req, res) => {
    try {
        const { error } = await insforge.database
            .from('units')
            .delete()
            .eq('id', req.params.id)
            ;

        if (error) {
            return res.status(500).json({ error: 'Failed to delete unit' });
        }

        return res.json({ message: 'Unit deleted successfully' });
    } catch (error) {
        console.error('Delete unit error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ============ QR CODES ============

/**
 * GET /api/admin/qr
 */
router.get('/qr', async (req, res) => {
    try {
        const { data, error } = await insforge.database
            .from('qr_codes')
            .select('*')
            .eq('society_id', req.society_id)
            .order('qr_code', { ascending: true });

        if (error) {
            return res.status(500).json({ error: 'Failed to fetch QR codes' });
        }

        return res.json(data || []);
    } catch (error) {
        console.error('Admin QR error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/admin/qr/batch
 * Body: { start, end } e.g. { start: 1001, end: 1100 }
 */
router.post('/qr/batch', async (req, res) => {
    try {
        const { start, end } = req.body;
        if (!start || !end || end < start) {
            return res.status(400).json({ error: 'Valid start and end numbers are required' });
        }
        if (end - start > 500) {
            return res.status(400).json({ error: 'Maximum 500 QR codes per batch' });
        }

        const qrCodes = [];
        for (let i = start; i <= end; i++) {
            qrCodes.push({
                qr_code: `${i}`,
                society_id: req.society_id,
                status: 'free',
            });
        }

        const { data, error } = await insforge.database
            .from('qr_codes')
            .insert(qrCodes)
            .select();

        if (error) {
            console.error('QR batch error:', error);
            return res.status(500).json({ error: 'Failed to create QR codes. Some may already exist.' });
        }

        return res.status(201).json({ created: data?.length || 0, codes: data });
    } catch (error) {
        console.error('QR batch error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/admin/qr/:code
 * Body: { status, assigned_person_id }
 */
router.put('/qr/:code', async (req, res) => {
    try {
        const { status, assigned_person_id } = req.body;
        const updateData = {};
        if (status) updateData.status = status;
        if (assigned_person_id !== undefined) {
            updateData.assigned_person_id = assigned_person_id;
            if (assigned_person_id) {
                updateData.assigned_at = new Date().toISOString();
            }
        }

        const { data, error } = await insforge.database
            .from('qr_codes')
            .update(updateData)
            .eq('qr_code', req.params.code)
            .select().single();

        if (error) {
            return res.status(500).json({ error: 'Failed to update QR code' });
        }

        return res.json(data);
    } catch (error) {
        console.error('Update QR error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/admin/qr/:code
 */
router.delete('/qr/:code', async (req, res) => {
    try {
        const { error } = await insforge.database
            .from('qr_codes')
            .delete()
            .eq('qr_code', req.params.code)
            ;

        if (error) {
            return res.status(500).json({ error: 'Failed to delete QR code' });
        }

        return res.json({ message: 'QR Code deleted successfully' });
    } catch (error) {
        console.error('Delete QR error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ============ LOGS ============

/**
 * GET /api/admin/logs/entries?person=&unit=&guard=&type=&from=&to=&page=1&limit=50
 */
router.get('/logs/entries', async (req, res) => {
    try {
        const { person, unit, guard, type, from, to, page = 1, limit = 50 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let query = insforge.database
            .from('gate_entries')
            .select('*', { count: 'exact' })
            .eq('society_id', req.society_id)
            .order('entry_time', { ascending: false })
            .range(offset, offset + parseInt(limit) - 1);

        if (unit) query = query.eq('unit', unit);
        if (guard) query = query.eq('guard_id', guard);
        if (type) query = query.eq('entry_type', type);
        if (from) query = query.gte('entry_time', from);
        if (to) query = query.lte('entry_time', to);

        const { data, error, count } = await query;

        if (error) {
            return res.status(500).json({ error: 'Failed to fetch entry logs' });
        }

        // Fetch person names
        const personIds = [...new Set((data || []).map(e => e.person_id))];
        let persons = [];
        if (personIds.length > 0) {
            const { data: pData } = await insforge.database
                .from('known_persons')
                .select('id, name, mobile')
                .in('id', personIds);
            persons = pData || [];
        }
        const personMap = {};
        for (const p of persons) personMap[p.id] = p;

        // Fetch guard names
        const guardIds = [...new Set((data || []).map(e => e.guard_id))];
        let guardsList = [];
        if (guardIds.length > 0) {
            const { data: gData } = await insforge.database
                .from('guards')
                .select('id, name')
                .in('id', guardIds);
            guardsList = gData || [];
        }
        const guardMap = {};
        for (const g of guardsList) guardMap[g.id] = g;

        const result = (data || []).map(e => ({
            ...e,
            person_name: personMap[e.person_id]?.name || 'Unknown',
            person_mobile: personMap[e.person_id]?.mobile || '',
            guard_name: guardMap[e.guard_id]?.name || 'Unknown',
        }));

        return res.json({ entries: result, total: count || 0, page: parseInt(page), limit: parseInt(limit) });
    } catch (error) {
        console.error('Entry logs error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/admin/logs/activity?guard=&action=&from=&to=&page=1&limit=50
 */
router.get('/logs/activity', async (req, res) => {
    try {
        const { guard, action, from, to, page = 1, limit = 50 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let query = insforge.database
            .from('guard_activity')
            .select('*', { count: 'exact' })
            .eq('society_id', req.society_id)
            .order('created_at', { ascending: false })
            .range(offset, offset + parseInt(limit) - 1);

        if (guard) query = query.eq('guard_id', guard);
        if (action) query = query.eq('action', action);
        if (from) query = query.gte('created_at', from);
        if (to) query = query.lte('created_at', to);

        const { data, error, count } = await query;

        if (error) {
            return res.status(500).json({ error: 'Failed to fetch activity logs' });
        }

        // Fetch guard names
        const guardIds = [...new Set((data || []).map(e => e.guard_id))];
        let guards = [];
        if (guardIds.length > 0) {
            const { data: gData } = await insforge.database
                .from('guards')
                .select('id, name')
                .in('id', guardIds);
            guards = gData || [];
        }
        const guardMap = {};
        for (const g of guards) guardMap[g.id] = g;

        const result = (data || []).map(e => ({
            ...e,
            guard_name: guardMap[e.guard_id]?.name || 'Unknown',
        }));

        return res.json({ activities: result, total: count || 0, page: parseInt(page), limit: parseInt(limit) });
    } catch (error) {
        console.error('Activity logs error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});


module.exports = router;
