const express = require('express');
const insforge = require('../services/insforge');
const { authenticate, checkSocietyActive } = require('../middleware/auth');

const router = express.Router();

// All person routes require auth
router.use(authenticate, checkSocietyActive);

/**
 * GET /api/persons/search?mobile=xxx
 * Search known_persons by mobile GLOBALLY, then fetch society-specific data
 */
router.get('/search', async (req, res) => {
    try {
        const { mobile } = req.query;
        if (!mobile) {
            return res.status(400).json({ error: 'mobile query parameter is required' });
        }

        // Search globally by mobile
        const { data: person, error } = await insforge.database
            .from('known_persons')
            .select('*')
            .eq('mobile', mobile)
            .maybeSingle();

        if (error) {
            return res.status(500).json({ error: 'Search failed' });
        }

        if (!person) {
            return res.json({ found: false, person: null, vehicles: [], societyData: null });
        }

        // Fetch society-specific data for this person in the current society
        const { data: societyData } = await insforge.database
            .from('person_society_data')
            .select('*')
            .eq('person_id', person.id)
            .eq('society_id', req.society_id)
            .maybeSingle();

        // Fetch ALL vehicles for this person via person_vehicle_links
        const { data: links } = await insforge.database
            .from('person_vehicle_links')
            .select('vehicle_id')
            .eq('person_id', person.id);

        let vehicles = [];
        if (links && links.length > 0) {
            const vehicleIds = links.map(l => l.vehicle_id);
            const { data: vData } = await insforge.database
                .from('person_vehicles')
                .select('*')
                .in('id', vehicleIds)
                .order('created_at', { ascending: false });
            vehicles = vData || [];
        }

        // Merge unit from societyData into person for backward compatibility
        const personWithUnit = {
            ...person,
            unit: societyData?.unit || null,
        };

        return res.json({ found: true, person: personWithUnit, vehicles, societyData });
    } catch (error) {
        console.error('Person search error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/persons/vehicles/search?vehicle_number=XXX
 * Search for a vehicle GLOBALLY (unique across system)
 * MUST be before /:id/vehicles route
 */
router.get('/vehicles/search', async (req, res) => {
    try {
        const { vehicle_number } = req.query;
        if (!vehicle_number) {
            return res.status(400).json({ error: 'vehicle_number query parameter is required' });
        }

        const vNum = vehicle_number.toUpperCase();
        const cleaned = vNum.replace(/[^A-Z0-9]/g, '');
        const formatted = vNum.replace(/[^A-Z0-9-]/g, '');

        // Search for both the cleaned and formatted versions
        const { data: vehicle, error } = await insforge.database
            .from('person_vehicles')
            .select('*')
            .or(`vehicle_number.eq.${cleaned},vehicle_number.eq.${formatted}`)
            .maybeSingle();

        if (error) {
            console.error('Vehicle search error:', error);
            return res.status(500).json({ error: 'Search failed' });
        }

        if (!vehicle) {
            return res.json({ found: false, vehicle: null });
        }

        // Fetch person linked to this vehicle (take the first one if multiple)
        const { data: link } = await insforge.database
            .from('person_vehicle_links')
            .select('person_id')
            .eq('vehicle_id', vehicle.id)
            .limit(1)
            .maybeSingle();
        
        let person = null;
        let societyData = null;
        let otherVehicles = [];

        if (link) {
            const { data: p } = await insforge.database
                .from('known_persons')
                .select('*')
                .eq('id', link.person_id)
                .single();
            person = p;
            
            // Also get society data
            const { data: sData } = await insforge.database
                .from('person_society_data')
                .select('*')
                .eq('person_id', link.person_id)
                .eq('society_id', req.society_id)
                .maybeSingle();
            
            societyData = sData;

            // Get vehicles for this person
            const { data: vLinks } = await insforge.database
                .from('person_vehicle_links')
                .select('vehicle_id')
                .eq('person_id', link.person_id);
            if (vLinks && vLinks.length > 0) {
                const vIds = vLinks.map(l => l.vehicle_id);
                const { data: vData } = await insforge.database
                    .from('person_vehicles')
                    .select('*')
                    .in('id', vIds)
                    .order('created_at', { ascending: false });
                otherVehicles = vData || [];
            }
        }
        
        const personWithUnit = person ? { ...person, unit: societyData?.unit || null } : null;

        return res.json({ found: true, vehicle, person: personWithUnit, vehicles: otherVehicles });
    } catch (error) {
        console.error('Vehicle search error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/persons/search-global?mobile=xxx
 * Search for person by mobile GLOBALLY
 * Returns person details + vehicles if found
 */
router.get('/search-global', async (req, res) => {
    try {
        const { mobile } = req.query;
        if (!mobile) {
            return res.status(400).json({ error: 'mobile query parameter is required' });
        }

        const { data: person, error } = await insforge.database
            .from('known_persons')
            .select('*')
            .eq('mobile', mobile)
            .maybeSingle();

        if (error) {
            console.error('Global person search error:', error);
            return res.status(500).json({ error: 'Search failed' });
        }

        if (!person) {
            return res.json({ found: false, person: null, vehicles: [] });
        }

        // Fetch society-specific data for this person in the current society
        const { data: societyData } = await insforge.database
            .from('person_society_data')
            .select('*')
            .eq('person_id', person.id)
            .eq('society_id', req.society_id)
            .maybeSingle();

        // Fetch all vehicles for this person via person_vehicle_links
        const { data: links } = await insforge.database
            .from('person_vehicle_links')
            .select('vehicle_id')
            .eq('person_id', person.id);

        let vehicles = [];
        if (links && links.length > 0) {
            const vehicleIds = links.map(l => l.vehicle_id);
            const { data: vData } = await insforge.database
                .from('person_vehicles')
                .select('*')
                .in('id', vehicleIds)
                .order('created_at', { ascending: false });
            vehicles = vData || [];
        }

        // Merge unit from societyData into person for backward compatibility
        const personWithUnit = {
            ...person,
            unit: societyData?.unit || null,
        };

        return res.json({
            found: true,
            person: personWithUnit,
            vehicles: vehicles || [],
        });
    } catch (error) {
        console.error('Global person search error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/persons/search-qr?code=xxx
 * Search by QR code globally
 */
router.get('/search-qr', async (req, res) => {
    try {
        const { code } = req.query;
        if (!code) {
            return res.status(400).json({ error: 'code query parameter is required' });
        }

        // Find the QR code globally (since QR Code use globally)
        const { data: qr, error: qrErr } = await insforge.database
            .from('qr_codes')
            .select('*')
            .eq('qr_code', code)
            .maybeSingle();

        if (qrErr) {
            return res.status(500).json({ error: 'QR search failed' });
        }

        if (!qr) {
            return res.json({ found: false, qr_status: 'unknown', error: 'QR code not found in the system. Contact admin.' });
        }

        if (qr.status === 'free') {
            return res.json({ found: false, qr_status: 'free', qr_code: qr.qr_code });
        }

        if (qr.status === 'inactive') {
            return res.json({ found: false, qr_status: 'inactive', error: 'This QR code has been deactivated.' });
        }

        // QR is assigned — fetch person (globally)
        if (qr.assigned_person_id) {
            const { data: person } = await insforge.database
                .from('known_persons')
                .select('*')
                .eq('id', qr.assigned_person_id)
                .single();

            // Fetch society data for current society
            const { data: societyData } = await insforge.database
                .from('person_society_data')
                .select('*')
                .eq('person_id', qr.assigned_person_id)
                .eq('society_id', req.society_id)
                .maybeSingle();

            // Fetch vehicles via links
            const { data: links } = await insforge.database
                .from('person_vehicle_links')
                .select('vehicle_id')
                .eq('person_id', qr.assigned_person_id);

            let vehicles = [];
            if (links && links.length > 0) {
                const vehicleIds = links.map(l => l.vehicle_id);
                const { data: vData } = await insforge.database
                    .from('person_vehicles')
                    .select('*')
                    .in('id', vehicleIds)
                    .order('created_at', { ascending: false });
                vehicles = vData || [];
            }

            const personWithUnit = {
                ...person,
                unit: societyData?.unit || null,
            };

            return res.json({ found: true, qr_status: 'assigned', person: personWithUnit, vehicles: vehicles || [] });
        }

        return res.json({ found: false, qr_status: qr.status });
    } catch (error) {
        console.error('QR search error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/persons
 * Upsert a person — GLOBAL uniqueness on mobile
 * Body: { name, mobile, unit }
 * - If person exists globally: update name globally, upsert unit in person_society_data
 * - If new: create globally, create person_society_data
 */
router.post('/', async (req, res) => {
    try {
        const { name, mobile, unit } = req.body;
        if (!name || !mobile) {
            return res.status(400).json({ error: 'name and mobile are required' });
        }

        // Check if person exists globally by mobile
        const { data: existing } = await insforge.database
            .from('known_persons')
            .select('*')
            .eq('mobile', mobile)
            .maybeSingle();

        let person;
        let created = false;

        if (existing) {
            // Update global data (name)
            const { data: updated, error } = await insforge.database
                .from('known_persons')
                .update({ name })
                .eq('id', existing.id)
                .select()
                .single();

            if (error) {
                return res.status(500).json({ error: 'Failed to update person' });
            }
            person = updated;

            // Upsert society-specific data (unit)
            const { data: existingSocietyData } = await insforge.database
                .from('person_society_data')
                .select('*')
                .eq('person_id', existing.id)
                .eq('society_id', req.society_id)
                .maybeSingle();

            if (existingSocietyData) {
                // Update unit if provided
                if (unit !== undefined) {
                    await insforge.database
                        .from('person_society_data')
                        .update({ unit: unit || existingSocietyData.unit })
                        .eq('id', existingSocietyData.id);
                }
            } else {
                // Create new society link
                await insforge.database
                    .from('person_society_data')
                    .insert({
                        person_id: existing.id,
                        society_id: req.society_id,
                        unit: unit || null,
                    });
            }
        } else {
            // Insert new global person
            const { data: newPerson, error } = await insforge.database
                .from('known_persons')
                .insert({
                    name,
                    mobile,
                })
                .select()
                .single();

            if (error) {
                console.error('Person insert error:', error);
                return res.status(500).json({ error: 'Failed to create person' });
            }
            person = newPerson;
            created = true;

            // Create society-specific data
            await insforge.database
                .from('person_society_data')
                .insert({
                    person_id: newPerson.id,
                    society_id: req.society_id,
                    unit: unit || null,
                });
        }

        // Return person with unit merged
        const personWithUnit = { ...person, unit: unit || null };
        return res.status(created ? 201 : 200).json({ person: personWithUnit, created });
    } catch (error) {
        console.error('Upsert person error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/persons/:id/vehicles
 * Get all vehicles for a person (via person_vehicle_links)
 */
router.get('/:id/vehicles', async (req, res) => {
    try {
        // Fetch vehicle links for this person
        const { data: links, error: linkError } = await insforge.database
            .from('person_vehicle_links')
            .select('vehicle_id')
            .eq('person_id', req.params.id);

        if (linkError) {
            return res.status(500).json({ error: 'Failed to fetch vehicle links' });
        }

        if (!links || links.length === 0) {
            return res.json([]);
        }

        const vehicleIds = links.map(l => l.vehicle_id);
        const { data: vehicles, error } = await insforge.database
            .from('person_vehicles')
            .select('*')
            .in('id', vehicleIds)
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
 * Add a vehicle to a person — GLOBAL uniqueness on vehicle_number
 * Body: { vehicle_number }
 * - If vehicle exists globally: link to this person (if not already linked)
 * - If new: create globally + link
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

        const personId = req.params.id;

        // Check if vehicle exists GLOBALLY
        const { data: existingVehicle } = await insforge.database
            .from('person_vehicles')
            .select('*')
            .eq('vehicle_number', vehicle_number)
            .maybeSingle();

        if (existingVehicle) {
            // Vehicle already exists globally — check if THIS person is already linked
            const { data: existingLink } = await insforge.database
                .from('person_vehicle_links')
                .select('*')
                .eq('person_id', personId)
                .eq('vehicle_id', existingVehicle.id)
                .maybeSingle();

            if (existingLink) {
                // Already linked — return as duplicate
                return res.json({ vehicle: existingVehicle, duplicate: 'same_person' });
            }

            // Link to this person
            const { error: linkError } = await insforge.database
                .from('person_vehicle_links')
                .insert({
                    person_id: personId,
                    vehicle_id: existingVehicle.id,
                });

            if (linkError) {
                console.error('Vehicle link error:', linkError);
                return res.status(500).json({ error: 'Failed to link vehicle' });
            }

            return res.status(201).json({ vehicle: existingVehicle, duplicate: 'linked_global' });
        }

        // Vehicle doesn't exist anywhere — create new
        const { data: newVehicle, error: createError } = await insforge.database
            .from('person_vehicles')
            .insert({ vehicle_number })
            .select()
            .single();

        if (createError) {
            console.error('Vehicle insert error:', createError);
            return res.status(500).json({ error: 'Failed to add vehicle' });
        }

        // Create link
        const { error: linkError } = await insforge.database
            .from('person_vehicle_links')
            .insert({
                person_id: personId,
                vehicle_id: newVehicle.id,
            });

        if (linkError) {
            console.error('Vehicle link error:', linkError);
            // Clean up the vehicle since we couldn't link it
            await insforge.database.from('person_vehicles').delete().eq('id', newVehicle.id);
            return res.status(500).json({ error: 'Failed to link vehicle' });
        }

        return res.status(201).json({ vehicle: newVehicle, duplicate: null });
    } catch (error) {
        console.error('Add vehicle error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/persons/:person_id/vehicles/:vehicle_id
 * Update a vehicle number
 * Body: { vehicle_number }
 */
router.put('/:person_id/vehicles/:vehicle_id', async (req, res) => {
    try {
        const { vehicle_number } = req.body;
        if (!vehicle_number) {
            return res.status(400).json({ error: 'vehicle_number is required' });
        }

        const formatRegex = /^[A-Z]{2}-[0-9]{2}-[A-Z]{2}-[0-9]{4}$/;
        if (!formatRegex.test(vehicle_number)) {
            return res.status(400).json({ error: 'Vehicle number format must be AA-00-AA-0000 (e.g. MH-12-AB-1234)' });
        }

        // Check if the NEW vehicle_number already exists globally
        const { data: existingVehicle } = await insforge.database
            .from('person_vehicles')
            .select('*')
            .eq('vehicle_number', vehicle_number)
            .maybeSingle();

        if (existingVehicle && existingVehicle.id !== req.params.vehicle_id) {
            // Another vehicle already has this number — link person to it and unlink old
            const { data: existingLink } = await insforge.database
                .from('person_vehicle_links')
                .select('*')
                .eq('person_id', req.params.person_id)
                .eq('vehicle_id', existingVehicle.id)
                .maybeSingle();

            if (!existingLink) {
                await insforge.database
                    .from('person_vehicle_links')
                    .insert({
                        person_id: req.params.person_id,
                        vehicle_id: existingVehicle.id,
                    });
            }

            // Remove old link
            await insforge.database
                .from('person_vehicle_links')
                .delete()
                .eq('person_id', req.params.person_id)
                .eq('vehicle_id', req.params.vehicle_id);

            // Check if old vehicle has any remaining links
            const { data: remainingLinks } = await insforge.database
                .from('person_vehicle_links')
                .select('id')
                .eq('vehicle_id', req.params.vehicle_id)
                .limit(1);

            if (!remainingLinks || remainingLinks.length === 0) {
                // Check if referenced in gate_entries
                const { data: entries } = await insforge.database
                    .from('gate_entries')
                    .select('id')
                    .eq('vehicle_id', req.params.vehicle_id)
                    .limit(1);

                if (!entries || entries.length === 0) {
                    await insforge.database.from('person_vehicles').delete().eq('id', req.params.vehicle_id);
                }
            }

            return res.json(existingVehicle);
        }

        // No conflict — just update the vehicle number
        const { data, error } = await insforge.database
            .from('person_vehicles')
            .update({ vehicle_number })
            .eq('id', req.params.vehicle_id)
            .select()
            .single();

        if (error) {
            return res.status(500).json({ error: 'Failed to update vehicle' });
        }

        return res.json(data);
    } catch (error) {
        console.error('Update vehicle error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/persons/:person_id/vehicles/:vehicle_id
 * Remove person's link to a vehicle. Delete the vehicle if no one else uses it.
 */
router.delete('/:person_id/vehicles/:vehicle_id', async (req, res) => {
    try {
        // Remove the link
        const { error: unlinkError } = await insforge.database
            .from('person_vehicle_links')
            .delete()
            .eq('person_id', req.params.person_id)
            .eq('vehicle_id', req.params.vehicle_id);

        if (unlinkError) {
            return res.status(500).json({ error: 'Failed to unlink vehicle' });
        }

        // Check if any other person is linked to this vehicle
        const { data: remainingLinks } = await insforge.database
            .from('person_vehicle_links')
            .select('id')
            .eq('vehicle_id', req.params.vehicle_id)
            .limit(1);

        if (!remainingLinks || remainingLinks.length === 0) {
            // Check if vehicle is referenced in gate_entries
            const { data: entries } = await insforge.database
                .from('gate_entries')
                .select('id')
                .eq('vehicle_id', req.params.vehicle_id)
                .limit(1);

            if (!entries || entries.length === 0) {
                // Safe to delete the vehicle itself
                await insforge.database
                    .from('person_vehicles')
                    .delete()
                    .eq('id', req.params.vehicle_id);
            }
        }

        return res.json({ message: 'Vehicle unlinked successfully' });
    } catch (error) {
        console.error('Delete vehicle error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
