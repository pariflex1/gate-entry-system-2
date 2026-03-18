const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const brainDir = 'C:/Users/Osho/.gemini/antigravity/brain/fe7535cd-b628-4008-9704-1d7b60bd39d5';
const guardImg = path.join(brainDir, 'guard_pwa_icon_new_1773803774032.png');
const adminImg = path.join(brainDir, 'admin_pwa_icon_new_1773803790409.png');

const guardDest192 = 'd:/Visitor Management System/Gate Entry/gate-entry-system-2 - Backup/client/public/pwa-192x192.png';
const guardDest512 = 'd:/Visitor Management System/Gate Entry/gate-entry-system-2 - Backup/client/public/pwa-512x512.png';

const adminDest192 = 'd:/Visitor Management System/Gate Entry/gate-entry-system-2 - Backup/admin/public/pwa-192x192.png';
const adminDest512 = 'd:/Visitor Management System/Gate Entry/gate-entry-system-2 - Backup/admin/public/pwa-512x512.png';

async function processIcons() {
    try {
        // Guard PWA
        await sharp(guardImg).resize(192, 192).toFile(guardDest192);
        await sharp(guardImg).resize(512, 512).toFile(guardDest512);
        console.log('Processed Guard Icons');

        // Admin PWA
        await sharp(adminImg).resize(192, 192).toFile(adminDest192);
        await sharp(adminImg).resize(512, 512).toFile(adminDest512);
        console.log('Processed Admin Icons');
    } catch (err) {
        console.error('Resize failed:', err);
    }
}

processIcons();
