require('dotenv').config({ path: __dirname + '/../.env' });
const insforge = require('../services/insforge');

async function testFetchUser() {
    const email = 'test_fetch_' + Date.now() + '@example.com';
    const { data: authData, error: authErr } = await insforge.auth.signUp({
        email,
        password: 'password123',
    });

    // Try to fetch the user id using the service key
    const { data: users, error: fetchErr } = await insforge.database
        .from('auth.users')
        .select('id')
        .eq('email', email);

    console.log("Fetch users:", users);
    console.log("Fetch error:", fetchErr);

    // Also try checking the auth admin api
    if (insforge.auth.admin) {
        console.log("Auth admin API is available");
    } else {
        console.log("Auth admin API is NOT available");
    }
}

testFetchUser();
