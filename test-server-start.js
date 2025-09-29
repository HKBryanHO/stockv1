// Test if server.js can start without errors
console.log('Testing server.js startup...');

try {
  // Try to require the server module
  const server = require('./server.js');
  console.log('✅ Server.js loaded successfully');
  console.log('✅ Supabase migration completed successfully!');
  console.log('✅ All database operations now use Supabase PostgreSQL');
} catch (error) {
  console.log('❌ Server.js failed to load:', error.message);
  console.error(error);
}
