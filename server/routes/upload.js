const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const insforge = require('../services/insforge');
const { authenticate, checkSocietyActive } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB max upload

router.use(authenticate, checkSocietyActive);

/**
 * Compress image to WebP < 50KB
 */
async function compressToWebP(buffer) {
    let finalBuffer = await sharp(buffer)
        .webp({ quality: 80 })
        .resize({ width: 1024, withoutEnlargement: true })
        .toBuffer();

    if (finalBuffer.length > 50 * 1024) {
        finalBuffer = await sharp(buffer)
            .webp({ quality: 50 })
            .resize({ width: 800, withoutEnlargement: true })
            .toBuffer();
    }
    if (finalBuffer.length > 50 * 1024) {
        finalBuffer = await sharp(buffer)
            .webp({ quality: 30 })
            .resize({ width: 640, withoutEnlargement: true })
            .toBuffer();
    }
    return finalBuffer;
}

/**
 * POST /api/upload/person/:person_id
 * Upload and compress a person photo to WebP < 50KB
 * Updates the GLOBAL known_persons record
 */
router.post('/person/:person_id', upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No photo file provided' });
        }

        const personId = req.params.person_id;
        const finalBuffer = await compressToWebP(req.file.buffer);

        // Use personId in the path (global, not society-scoped)
        const filePath = `persons/${personId}/person.webp`;
        const blob = new Blob([finalBuffer], { type: 'image/webp' });

        const { data, error } = await insforge.storage
            .from('gate-photos')
            .upload(filePath, blob);

        if (error) {
            console.error('Photo upload error:', error);
            return res.status(500).json({ error: 'Failed to upload photo' });
        }

        // Update GLOBAL person_photo_url
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
 * Updates the GLOBAL person_vehicles record
 */
router.post('/vehicle/:vehicle_id', upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No photo file provided' });
        }

        const vehicleId = req.params.vehicle_id;
        const finalBuffer = await compressToWebP(req.file.buffer);

        // Use vehicleId in the path (global, not society-scoped)
        const filePath = `vehicles/${vehicleId}/vehicle.webp`;
        const blob = new Blob([finalBuffer], { type: 'image/webp' });

        const { data, error } = await insforge.storage
            .from('gate-photos')
            .upload(filePath, blob);

        if (error) {
            console.error('Vehicle photo upload error:', error);
            return res.status(500).json({ error: 'Failed to upload photo' });
        }

        // Update GLOBAL vehicle_photo_url
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
