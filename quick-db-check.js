#!/usr/bin/env node

console.log('🔍 Quick Database Status Check\n');

// Check if we're in a Render environment
const isRender = process.env.RENDER === 'true';
const isProduction = process.env.NODE_ENV === 'production';

console.log('🌐 Environment:');
console.log('  Render:', isRender ? '✅ Yes' : '❌ No');
console.log('  Production:', isProduction ? '✅ Yes' : '❌ No');
console.log('');

// Check environment variables
console.log('🔧 Environment Variables:');
const envVars = [
  'DATABASE_URL',
  'PG_USER', 
  'PG_HOST',
  'PG_DATABASE',
  'PG_PASSWORD',
  'PG_PORT',
  'PG_SSL'
];

envVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    if (varName.includes('PASSWORD')) {
      console.log(`  ${varName}: ✅ Set (${value.length} chars)`);
    } else {
      console.log(`  ${varName}: ✅ Set (${value})`);
    }
  } else {
    console.log(`  ${varName}: ❌ Not set`);
  }
});

console.log('');

// Check if we have the required packages
console.log('📦 Required Packages:');
try {
  require('pg');
  console.log('  pg (PostgreSQL): ✅ Installed');
} catch (error) {
  console.log('  pg (PostgreSQL): ❌ Not installed');
}

try {
  require('sqlite3');
  console.log('  sqlite3: ✅ Installed');
} catch (error) {
  console.log('  sqlite3: ❌ Not installed');
}

console.log('');

// Quick connection test
async function quickTest() {
  console.log('🔗 Quick Connection Test:');
  
  try {
    const { Pool } = require('pg');
    
    // Use DATABASE_URL if available, otherwise use individual vars
    let config = {};
    if (process.env.DATABASE_URL) {
      config = {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      };
    } else {
      config = {
        user: process.env.PG_USER || 'postgres',
        host: process.env.PG_HOST || 'db.ghtqyibmlltkpmcuuanj.supabase.co',
        database: process.env.PG_DATABASE || 'postgres',
        password: process.env.PG_PASSWORD || 'Bho123456!',
        port: process.env.PG_PORT || 5432,
        ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : true
      };
    }
    
    const pool = new Pool(config);
    const client = await pool.connect();
    
    console.log('  PostgreSQL: ✅ Connected successfully!');
    
    // Quick table check
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      LIMIT 5
    `);
    
    console.log(`  Tables found: ${result.rows.length}`);
    
    client.release();
    await pool.end();
    
    console.log('\n🎉 Your database is ready!');
    
  } catch (error) {
    console.log('  PostgreSQL: ❌ Connection failed');
    console.log('  Error:', error.message);
    
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check if DATABASE_URL is set correctly');
    console.log('2. Verify your Supabase database is accessible');
    console.log('3. Make sure PG_SSL=true is set');
    console.log('4. Check your database credentials');
  }
}

quickTest();
