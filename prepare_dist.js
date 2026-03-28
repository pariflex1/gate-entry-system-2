const fs = require('fs-extra');
const path = require('path');

async function prepareDist() {
    const rootDir = __dirname;
    const distDir = path.join(rootDir, 'dist');
    
    // Copy necessary backend folders for Serverless deployment
    await fs.copy(path.join(rootDir, 'api'), path.join(distDir, 'api'));
    await fs.copy(path.join(rootDir, 'server'), path.join(distDir, 'server'));
    
    // Copy vercel.json
    await fs.copy(path.join(rootDir, 'vercel.json'), path.join(distDir, 'vercel.json'));
    
    // Create a modified package.json for the deployment without build scripts 
    // to bypass the cloud frontend build but keep dependencies
    const pkg = await fs.readJson(path.join(rootDir, 'package.json'));
    pkg.scripts = {}; 
    await fs.writeJson(path.join(distDir, 'package.json'), pkg, { spaces: 2 });
    
    console.log('Prepared dist/ directory with backend files.');
}

prepareDist().catch(console.error);
