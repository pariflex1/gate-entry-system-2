require('dotenv').config({ path: __dirname + '/../.env' });
const insforge = require('../services/insforge');

async function testSignup() {
    console.log("Testing signup...");
    const { data: authData, error: authErr } = await insforge.auth.signUp({
        email: 'test_auth_id_' + Date.now() + '@example.com',
        password: 'password123',
    });
    console.log("authData:", JSON.stringify(authData, null, 2));
    console.log("authErr:", authErr);
}

testSignup();
