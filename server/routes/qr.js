const express = require('express');
const insforge = require('../services/insforge');
const { authenticate, checkSocietyActive } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate, checkSocietyActive);

/**
 * POST /api/qr/assign
 * Body: { mobile, qr_code }
 * Assign a QR code to a person (by mobile). Creates person if not found.
 */
router.post('/assign', async (req, res) => {
    try {
        const { mobile, qr_code, name, unit } = req.body;
        if (!mobile || !qr_code) {
            return res.status(400).json({ error: 'mobile and qr_code are required' });
        }

        // Validate QR code belongs to this society and is free
        const { data: qr, error: qrErr } = await insforge.database
            .from('qr_codes')
            .select('*')
            .eq('qr_code', qr_code)
            .eq('society_id', req.society_id)
            .maybeSingle();

        if (qrErr || !qr) {
            return res.status(404).json({ error: 'QR code not found in this society' });
        }
        if (qr.status !== 'free') {
            return res.status(400).json({ error: `QR code is currently ${qr.status}. Deactivate it first.` });
        }

        // Find or create person
        let person;
        const { data: existing } = await insforge.database
            .from('known_persons')
            .select('*')
            .eq('society_id', req.society_id)
            .eq('mobile', mobile)
            .maybeSingle();

        if (existing) {
            person = existing;
        } else {
            if (!name) {
                return res.status(400).json({ error: 'name is required for new persons' });
            }
            const { data: newPerson, error: insertErr } = await insforge.database
                .from('known_persons')
                .insert({
                    society_id: req.society_id,
                    name,
                    mobile,
                    unit: unit || null,
                })
                .select()
                .single();

            if (insertErr) {
                return res.status(500).json({ error: 'Failed to create person' });
            }
            person = newPerson;
        }

        // Update QR code → assigned
        await insforge.database
            .from('qr_codes')
            .update({
                status: 'assigned',
                assigned_person_id: person.id,
                assigned_at: new Date().toISOString(),
            })
            .eq('qr_code', qr_code)
            .eq('society_id', req.society_id);

        // Update person → qr_code + qr_status
        await insforge.database
            .from('known_persons')
            .update({ qr_code, qr_status: 'active' })
            .eq('id', person.id);

        // Log guard activity
        if (req.guard_id) {
            await insforge.database.from('guard_activity').insert({
                society_id: req.society_id,
                guard_id: req.guard_id,
                action: 'ASSIGN_QR',
                detail: `QR ${qr_code} assigned to ${person.name} (${person.mobile})`,
            });
        }

        return res.json({ message: 'QR code assigned successfully', person, qr_code });
    } catch (error) {
        console.error('QR assign error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/qr/deactivate
 * Body: { qr_code }
 */
router.post('/deactivate', async (req, res) => {
    try {
        const { qr_code } = req.body;
        if (!qr_code) {
            return res.status(400).json({ error: 'qr_code is required' });
        }

        // Get the QR record
        const { data: qr } = await insforge.database
            .from('qr_codes')
            .select('*')
            .eq('qr_code', qr_code)
            .eq('society_id', req.society_id)
            .maybeSingle();

        if (!qr) {
            return res.status(404).json({ error: 'QR code not found' });
        }

        // Deactivate QR
        await insforge.database
            .from('qr_codes')
            .update({ status: 'inactive', assigned_person_id: null })
            .eq('qr_code', qr_code)
            .eq('society_id', req.society_id);

        // If was assigned to a person, clear their QR
        if (qr.assigned_person_id) {
            await insforge.database
                .from('known_persons')
                .update({ qr_code: null, qr_status: 'inactive' })
                .eq('id', qr.assigned_person_id);
        }

        // Log
        if (req.guard_id) {
            await insforge.database.from('guard_activity').insert({
                society_id: req.society_id,
                guard_id: req.guard_id,
                action: 'DEACTIVATE_QR',
                detail: `QR ${qr_code} deactivated`,
            });
        }

        return res.json({ message: 'QR code deactivated' });
    } catch (error) {
        console.error('QR deactivate error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
