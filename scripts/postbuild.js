const fs = require('fs');
const path = require('path');

/**
 * Cross-platform build script to replace PowerShell commands.
 * Handles directory creation and recursive copying of build artifacts.
 */

function copyRecursiveSync(src, dest) {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();
    if (isDirectory) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        fs.readdirSync(src).forEach((childItemName) => {
            copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
        });
    } else {
        fs.copyFileSync(src, dest);
    }
}

// 1. Ensure dist directories exist
const distPath = path.join(__dirname, '..', 'dist');
const adminDist = path.join(distPath, 'admin');
const clientDist = path.join(distPath, 'client');

[distPath, adminDist, clientDist].forEach(p => {
    if (!fs.existsSync(p)) {
        fs.mkdirSync(p, { recursive: true });
        console.log(`Created: ${p}`);
    }
});

// 2. Copy artifacts
console.log('Copying Admin build...');
copyRecursiveSync(path.join(__dirname, '..', 'admin', 'dist'), adminDist);

console.log('Copying Client build...');
copyRecursiveSync(path.join(__dirname, '..', 'client', 'dist'), clientDist);

console.log('Copying index.html to dist root...');
fs.copyFileSync(path.join(__dirname, '..', 'index.html'), path.join(distPath, 'index.html'));

console.log('Build preparation complete! ✅');
