#!/usr/bin/env node

const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

console.log('🔍 Database Status Checker\n');
console.log('=' .repeat(50));

// Check environment variables
console.log('📋 Environment Variables:');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✅ Set' : '❌ Not set');
console.log('PG_USER:', process.env.PG_USER || 'Not set');
console.log('PG_HOST:', process.env.PG_HOST || 'Not set');
console.log('PG_DATABASE:', process.env.PG_DATABASE || 'Not set');
console.log('PG_PASSWORD:', process.env.PG_PASSWORD ? '✅ Set' : '❌ Not set');
console.log('PG_PORT:', process.env.PG_PORT || 'Not set');
console.log('PG_SSL:', process.env.PG_SSL || 'Not set');
console.log('');

// Test PostgreSQL Connection
async function testPostgreSQL() {
  console.log('🐘 Testing PostgreSQL Connection...');
  
  try {
    // PostgreSQL 連接配置
    const pgConfig = {
      user: process.env.PG_USER || 'postgres',
      host: process.env.PG_HOST || 'db.ghtqyibmlltkpmcuuanj.supabase.co',
      database: process.env.PG_DATABASE || 'postgres',
      password: process.env.PG_PASSWORD || 'Bho123456!',
      port: process.env.PG_PORT || 5432,
      ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : true
    };

    // 如果提供了 DATABASE_URL，優先使用它
    if (process.env.DATABASE_URL) {
      pgConfig.connectionString = process.env.DATABASE_URL;
    }

    let pgPool;
    if (pgConfig.connectionString) {
      console.log('🔗 Using DATABASE_URL connection...');
      pgPool = new Pool({
        connectionString: pgConfig.connectionString,
        ssl: { rejectUnauthorized: false }
      });
    } else {
      console.log('🔗 Using individual connection parameters...');
      pgPool = new Pool(pgConfig);
    }

    // 測試連接
    const client = await pgPool.connect();
    console.log('✅ PostgreSQL connection successful!');
    
    // 測試查詢
    const versionResult = await client.query('SELECT version()');
    console.log('📊 PostgreSQL version:', versionResult.rows[0].version.split(' ')[0]);
    
    // 檢查現有表
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('📋 Existing tables:');
    if (tablesResult.rows.length > 0) {
      tablesResult.rows.forEach(row => {
        console.log(`   ✅ ${row.table_name}`);
      });
    } else {
      console.log('   ❌ No tables found');
    }
    
    // 檢查用戶表數據
    try {
      const userCountResult = await client.query('SELECT COUNT(*) as count FROM users');
      console.log(`👥 Users in database: ${userCountResult.rows[0].count}`);
    } catch (error) {
      console.log('👥 Users table: ❌ Not found or empty');
    }
    
    client.release();
    await pgPool.end();
    
    return { success: true, message: 'PostgreSQL is working correctly!' };
    
  } catch (error) {
    console.log('❌ PostgreSQL connection failed:', error.message);
    return { success: false, message: error.message };
  }
}

// Test SQLite Connection
async function testSQLite() {
  console.log('\n🗃️ Testing SQLite Connection...');
  
  try {
    const sqlitePath = path.join(__dirname, 'database', 'users.db');
    console.log('📁 SQLite path:', sqlitePath);
    
    const db = new sqlite3.Database(sqlitePath, (err) => {
      if (err) {
        console.log('❌ SQLite connection failed:', err.message);
        return { success: false, message: err.message };
      }
    });
    
    // 檢查表是否存在
    return new Promise((resolve) => {
      db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
        if (err) {
          console.log('❌ SQLite query failed:', err.message);
          resolve({ success: false, message: err.message });
        } else {
          console.log('✅ SQLite connection successful!');
          console.log('📋 SQLite tables:');
          if (rows.length > 0) {
            rows.forEach(row => {
              console.log(`   ✅ ${row.name}`);
            });
          } else {
            console.log('   ❌ No tables found');
          }
          
          // 檢查用戶數據
          db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
            if (err) {
              console.log('👥 Users table: ❌ Not found or empty');
            } else {
              console.log(`👥 Users in SQLite: ${row.count}`);
            }
            db.close();
            resolve({ success: true, message: 'SQLite is working correctly!' });
          });
        }
      });
    });
    
  } catch (error) {
    console.log('❌ SQLite connection failed:', error.message);
    return { success: false, message: error.message };
  }
}

// Test UserManager Classes
function testUserManagers() {
  console.log('\n👤 Testing UserManager Classes...');
  
  // Test PostgreSQL UserManager
  try {
    const PostgresUserManager = require('./auth/postgresUserManager');
    console.log('✅ PostgresUserManager: Available');
  } catch (error) {
    console.log('❌ PostgresUserManager: Not available -', error.message);
  }
  
  // Test SQLite UserManager
  try {
    const UserManager = require('./auth/userManager');
    console.log('✅ SQLite UserManager: Available');
  } catch (error) {
    console.log('❌ SQLite UserManager: Not available -', error.message);
  }
}

// Main function
async function main() {
  console.log('🚀 Starting database diagnostics...\n');
  
  // Test UserManager classes
  testUserManagers();
  
  // Test PostgreSQL
  const pgResult = await testPostgreSQL();
  
  // Test SQLite
  const sqliteResult = await testSQLite();
  
  // Summary
  console.log('\n' + '=' .repeat(50));
  console.log('📊 SUMMARY:');
  console.log('PostgreSQL:', pgResult.success ? '✅ Working' : '❌ Failed');
  console.log('SQLite:', sqliteResult.success ? '✅ Working' : '❌ Failed');
  
  if (pgResult.success) {
    console.log('\n🎉 PostgreSQL is ready! Your app will use PostgreSQL.');
  } else if (sqliteResult.success) {
    console.log('\n⚠️ PostgreSQL failed, but SQLite is working. App will use SQLite.');
  } else {
    console.log('\n❌ Both databases failed. Check your configuration.');
  }
  
  console.log('\n🔧 Next steps:');
  if (!pgResult.success) {
    console.log('1. Set DATABASE_URL environment variable');
    console.log('2. Check your Supabase database credentials');
    console.log('3. Ensure your database is accessible');
  }
  if (pgResult.success) {
    console.log('1. Your PostgreSQL setup is working correctly!');
    console.log('2. Deploy to Render with the DATABASE_URL environment variable');
  }
}

// Run the diagnostics
main().catch(console.error);
