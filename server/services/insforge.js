const { createClient } = require('@insforge/sdk');

const insforge = createClient({
  baseUrl: process.env.INSFORGE_URL,
  anonKey: process.env.INSFORGE_SERVICE_KEY
});

module.exports = insforge;
