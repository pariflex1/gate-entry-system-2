const insforge = require('./server/services/insforge');

console.log('--- InsForge Auth Functions ---');
const auth = insforge.auth;
let proto = Object.getPrototypeOf(auth);
while (proto) {
    Object.getOwnPropertyNames(proto).forEach(prop => {
        if (typeof auth[prop] === 'function') {
            console.log('Auth function:', prop);
        }
    });
    proto = Object.getPrototypeOf(proto);
}
