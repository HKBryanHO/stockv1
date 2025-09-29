#!/usr/bin/env node

const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

console.log('🔄 數據庫遷移到 PostgreSQL...\n');

// PostgreSQL 連接配置
const pgConfig = {
  user: process.env.PG_USER || 'your_username',
  host: process.env.PG_HOST || 'your_host',
  database: process.env.PG_DATABASE || 'your_database',
  password: process.env.PG_PASSWORD || 'your_password',
  port: process.env.PG_PORT || 5432,
  ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false
};

// SQLite 數據庫路徑
const sqlitePath = path.join(__dirname, 'database', 'users.db');

// 創建 PostgreSQL 連接池
const pgPool = new Pool(pgConfig);

// PostgreSQL 表結構
const createTablesSQL = `
-- 用戶表
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role VARCHAR(20) DEFAULT 'user' CHECK(role IN ('admin', 'user', 'premium')),
    status VARCHAR(20) DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'suspended')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    preferences TEXT,
    api_quota INTEGER DEFAULT 1000,
    api_usage INTEGER DEFAULT 0
);

-- 用戶會話表
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT
);

-- 用戶投資組合表
CREATE TABLE IF NOT EXISTS user_portfolios (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    holdings JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_default BOOLEAN DEFAULT FALSE
);

-- 用戶預測表
CREATE TABLE IF NOT EXISTS user_predictions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    prediction_data JSONB NOT NULL,
    model_used VARCHAR(50),
    confidence_score DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 用戶查詢表
CREATE TABLE IF NOT EXISTS user_queries (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK(type IN ('stock', 'ai', 'prediction', 'analysis')),
    content TEXT NOT NULL,
    result TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 創建索引
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_portfolios_user_id ON user_portfolios(user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_user_id ON user_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_symbol ON user_predictions(symbol);
CREATE INDEX IF NOT EXISTS idx_queries_username ON user_queries(username);
CREATE INDEX IF NOT EXISTS idx_queries_type ON user_queries(type);
CREATE INDEX IF NOT EXISTS idx_queries_created_at ON user_queries(created_at);

-- 創建 JSONB 索引
CREATE INDEX IF NOT EXISTS idx_portfolios_holdings ON user_portfolios USING GIN (holdings);
CREATE INDEX IF NOT EXISTS idx_predictions_data ON user_predictions USING GIN (prediction_data);
CREATE INDEX IF NOT EXISTS idx_queries_metadata ON user_queries USING GIN (metadata);
`;

// 遷移數據
async function migrateData() {
  try {
    console.log('🔗 測試 PostgreSQL 連接...');
    const client = await pgPool.connect();
    console.log('✅ PostgreSQL 連接成功');
    
    console.log('🏗️ 創建 PostgreSQL 表結構...');
    await client.query(createTablesSQL);
    console.log('✅ 表結構創建成功');
    
    // 連接 SQLite 數據庫
    console.log('🔗 連接 SQLite 數據庫...');
    const sqliteDb = new sqlite3.Database(sqlitePath, (err) => {
      if (err) {
        console.error('❌ SQLite 連接失敗:', err.message);
        return;
      }
      console.log('✅ SQLite 連接成功');
    });
    
    // 遷移用戶數據
    console.log('👤 遷移用戶數據...');
    const users = await new Promise((resolve, reject) => {
      sqliteDb.all('SELECT * FROM users', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    for (const user of users) {
      const insertUserSQL = `
        INSERT INTO users (id, username, email, password_hash, full_name, role, status, created_at, updated_at, last_login, preferences, api_quota, api_usage)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO NOTHING
      `;
      
      await client.query(insertUserSQL, [
        user.id,
        user.username,
        user.email,
        user.password_hash,
        user.full_name,
        user.role,
        user.status,
        user.created_at,
        user.updated_at,
        user.last_login,
        user.preferences,
        user.api_quota,
        user.api_usage
      ]);
    }
    console.log(`✅ 遷移 ${users.length} 個用戶`);
    
    // 遷移查詢記錄
    console.log('📝 遷移查詢記錄...');
    const queries = await new Promise((resolve, reject) => {
      sqliteDb.all('SELECT * FROM user_queries', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    for (const query of queries) {
      const insertQuerySQL = `
        INSERT INTO user_queries (id, username, type, content, result, metadata, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO NOTHING
      `;
      
      let metadata = null;
      if (query.metadata) {
        try {
          metadata = JSON.parse(query.metadata);
        } catch (e) {
          metadata = { raw: query.metadata };
        }
      }
      
      await client.query(insertQuerySQL, [
        query.id,
        query.username,
        query.type,
        query.content,
        query.result,
        metadata,
        query.created_at
      ]);
    }
    console.log(`✅ 遷移 ${queries.length} 條查詢記錄`);
    
    // 遷移會話數據
    console.log('🔐 遷移會話數據...');
    const sessions = await new Promise((resolve, reject) => {
      sqliteDb.all('SELECT * FROM user_sessions', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    for (const session of sessions) {
      const insertSessionSQL = `
        INSERT INTO user_sessions (id, user_id, session_token, expires_at, created_at, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO NOTHING
      `;
      
      await client.query(insertSessionSQL, [
        session.id,
        session.user_id,
        session.session_token,
        session.expires_at,
        session.created_at,
        session.ip_address,
        session.user_agent
      ]);
    }
    console.log(`✅ 遷移 ${sessions.length} 個會話`);
    
    // 關閉連接
    client.release();
    sqliteDb.close();
    
    console.log('\n🎯 數據庫遷移完成！');
    console.log('\n📊 遷移統計:');
    console.log(`   用戶: ${users.length}`);
    console.log(`   查詢記錄: ${queries.length}`);
    console.log(`   會話: ${sessions.length}`);
    
    console.log('\n🔧 下一步:');
    console.log('1. 更新環境變量設置 PostgreSQL 連接');
    console.log('2. 修改代碼使用 PostgreSQL 驅動');
    console.log('3. 測試新數據庫連接');
    console.log('4. 部署到生產環境');
    
  } catch (error) {
    console.error('❌ 遷移失敗:', error.message);
    process.exit(1);
  } finally {
    await pgPool.end();
  }
}

// 開始遷移
migrateData();
