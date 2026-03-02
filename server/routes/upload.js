const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const insforge = require('../services/insforge');
const { authenticate, checkSocietyActive } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB max upload

router.use(authenticate, checkSocietyActive);

/**
 * POST /api/upload/person/:person_id
 * Upload and compress a person photo to WebP < 50KB
 */
router.post('/person/:person_id', upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No photo file provided' });
        }

        const personId = req.params.person_id;
        const societyId = req.society_id;

        // Convert to WebP < 50KB
        const webpBuffer = await sharp(req.file.buffer)
            .webp({ quality: 80 })
            .resize({ width: 1024, withoutEnlargement: true })
            .toBuffer();

        // Check size — if still > 50KB, reduce quality
        let finalBuffer = webpBuffer;
        if (webpBuffer.length > 50 * 1024) {
            finalBuffer = await sharp(req.file.buffer)
                .webp({ quality: 50 })
                .resize({ width: 800, withoutEnlargement: true })
                .toBuffer();
        }
        if (finalBuffer.length > 50 * 1024) {
            finalBuffer = await sharp(req.file.buffer)
                .webp({ quality: 30 })
                .resize({ width: 640, withoutEnlargement: true })
                .toBuffer();
        }

        const filePath = `${societyId}/persons/${personId}/person.webp`;
        const blob = new Blob([finalBuffer], { type: 'image/webp' });

        const { data, error } = await insforge.storage
            .from('gate-photos')
            .upload(filePath, blob);

        if (error) {
            console.error('Photo upload error:', error);
            return res.status(500).json({ error: 'Failed to upload photo' });
        }

        // Update person_photo_url
        const photoUrl = data.url;
        await insforge.database
            .from('known_persons')
            .update({ person_photo_url: photoUrl })
            .eq('id', personId);

        return res.json({ url: photoUrl, key: data.key, size: finalBuffer.length });
    } catch (error) {
        console.error('Person photo upload error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/upload/vehicle/:vehicle_id
 * Upload and compress a vehicle photo to WebP < 50KB
 */
router.post('/vehicle/:vehicle_id', upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No photo file provided' });
        }

        const vehicleId = req.params.vehicle_id;
        const societyId = req.society_id;

        // Get person_id for this vehicle
        const { data: vehicle } = await insforge.database
            .from('person_vehicles')
            .select('person_id')
            .eq('id', vehicleId)
            .eq('society_id', societyId)
            .single();

        if (!vehicle) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }

        // Convert to WebP < 50KB
        const webpBuffer = await sharp(req.file.buffer)
            .webp({ quality: 80 })
            .resize({ width: 1024, withoutEnlargement: true })
            .toBuffer();

        let finalBuffer = webpBuffer;
        if (webpBuffer.length > 50 * 1024) {
            finalBuffer = await sharp(req.file.buffer)
                .webp({ quality: 50 })
                .resize({ width: 800, withoutEnlargement: true })
                .toBuffer();
        }
        if (finalBuffer.length > 50 * 1024) {
            finalBuffer = await sharp(req.file.buffer)
                .webp({ quality: 30 })
                .resize({ width: 640, withoutEnlargement: true })
                .toBuffer();
        }

        const filePath = `${societyId}/persons/${vehicle.person_id}/vehicles/${vehicleId}.webp`;
        const blob = new Blob([finalBuffer], { type: 'image/webp' });

        const { data, error } = await insforge.storage
            .from('gate-photos')
            .upload(filePath, blob);

        if (error) {
            console.error('Vehicle photo upload error:', error);
            return res.status(500).json({ error: 'Failed to upload photo' });
        }

        // Update vehicle_photo_url
        const photoUrl = data.url;
        await insforge.database
            .from('person_vehicles')
            .update({ vehicle_photo_url: photoUrl })
            .eq('id', vehicleId);

        return res.json({ url: photoUrl, key: data.key, size: finalBuffer.length });
    } catch (error) {
        console.error('Vehicle photo upload error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
