#!/usr/bin/env node

const { Pool } = require('pg');

console.log('🔗 Testing PostgreSQL connection...\n');

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

console.log('📋 Connection config:', {
  host: pgConfig.host || 'from DATABASE_URL',
  port: pgConfig.port || 'from DATABASE_URL',
  database: pgConfig.database || 'from DATABASE_URL',
  user: pgConfig.user || 'from DATABASE_URL',
  ssl: pgConfig.ssl
});

async function testConnection() {
  let pgPool;
  
  try {
    // 創建連接池
    if (pgConfig.connectionString) {
      console.log('🔗 Using DATABASE_URL connection string...');
      pgPool = new Pool({
        connectionString: pgConfig.connectionString,
        ssl: { rejectUnauthorized: false }
      });
    } else {
      console.log('🔗 Using individual connection parameters...');
      pgPool = new Pool(pgConfig);
    }

    // 測試連接
    console.log('⏳ Connecting to PostgreSQL...');
    const client = await pgPool.connect();
    console.log('✅ PostgreSQL connection successful!');
    
    // 測試查詢
    console.log('⏳ Testing query...');
    const result = await client.query('SELECT version()');
    console.log('✅ Query successful!');
    console.log('📊 PostgreSQL version:', result.rows[0].version);
    
    // 檢查現有表
    console.log('⏳ Checking existing tables...');
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    if (tablesResult.rows.length > 0) {
      console.log('📋 Existing tables:');
      tablesResult.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
    } else {
      console.log('📋 No tables found in public schema');
    }
    
    client.release();
    await pgPool.end();
    
    console.log('\n🎉 PostgreSQL connection test completed successfully!');
    console.log('\n🔧 Next steps:');
    console.log('1. Run the migration script: node migrate-to-postgresql.js');
    console.log('2. Update your server to use PostgreSQL instead of SQLite');
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('🔍 Error details:', error);
    
    if (pgPool) {
      await pgPool.end();
    }
    
    process.exit(1);
  }
}

testConnection();


