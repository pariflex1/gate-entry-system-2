const fetch = require('node-fetch') || global.fetch;
fetch('http://localhost:5000/api/auth/admin-login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'pariflex@gmail.com', password: 'password1' })
})
.then(r => r.text().then(text => ({ status: r.status, text })))
.then(console.log)
.catch(console.error);
