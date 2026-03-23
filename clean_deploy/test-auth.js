const insforge = require('./server/services/insforge');
try {
    insforge.auth.getUser('abc');
    console.log('getUser exists');
} catch (e) {
    console.log('getUser NOT found:', e.message);
}

try {
    insforge.auth.getCurrentUser('abc');
    console.log('getCurrentUser exists (and took 1 argument)');
} catch (e) {
    console.log('getCurrentUser check failed:', e.message);
}
