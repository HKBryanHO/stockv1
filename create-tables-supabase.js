const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ghtqyibmlltkpmcuuanj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodHF5aWJtbGx0a3BtY3V1YW5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxMTQ2MDQsImV4cCI6MjA3NDY5MDYwNH0.zqbr8jaE4ENVumrErp4q8oc__LPx4MlW25Cl1vCiwOM'
);

async function createTablesInSupabase() {
  try {
    console.log('🔧 在Supabase中創建必要的表...');
    
    // 注意：Supabase的JavaScript客戶端無法直接執行DDL語句
    // 我們需要通過Supabase Dashboard的SQL編輯器來創建表
    
    console.log('⚠️  重要：請在Supabase Dashboard中執行以下SQL:');
    console.log('\n📋 複製以下SQL到Supabase Dashboard的SQL編輯器中:');
    console.log(`
-- 1. 創建sessions表
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 2. 創建user_queries表
CREATE TABLE IF NOT EXISTS user_queries (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK(type IN ('stock', 'ai', 'prediction', 'analysis')),
  content TEXT NOT NULL,
  result TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
);

-- 3. 創建索引
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_queries_username ON user_queries(username);
CREATE INDEX IF NOT EXISTS idx_user_queries_type ON user_queries(type);
CREATE INDEX IF NOT EXISTS idx_user_queries_created_at ON user_queries(created_at);

-- 4. 確保admin用戶存在且角色正確
INSERT INTO users (username, email, password_hash, full_name, role, status, api_quota, created_at)
VALUES (
  'admin', 
  'admin@stockpredictor.com', 
  '$2b$10$rQZ8k9mN2pL7sT3uV6wXeOqR4nH8cF1jK5mP9sL2vB6xE7yA3zC8wQ5rT', 
  'System Administrator', 
  'admin', 
  'active', 
  10000, 
  NOW()
)
ON CONFLICT (username) 
DO UPDATE SET 
  role = 'admin',
  status = 'active',
  api_quota = 10000,
  updated_at = NOW();

-- 5. 添加一些測試查詢記錄
INSERT INTO user_queries (username, type, content, result, metadata, created_at)
VALUES 
  ('admin', 'stock', 'AAPL股價分析', 'AAPL當前價格: $150.00', '{"symbol": "AAPL", "price": 150.00}', NOW()),
  ('admin', 'ai', '什麼是股票投資？', '股票投資是購買公司股份的行為...', '{"model": "GPT-4", "category": "general"}', NOW()),
  ('admin', 'stock', 'TSLA技術分析', 'TSLA技術指標顯示...', '{"symbol": "TSLA", "analysis": "technical"}', NOW())
ON CONFLICT DO NOTHING;

-- 6. 檢查結果
SELECT 'Tables created successfully' as status;
SELECT username, role, status FROM users WHERE username = 'admin';
SELECT COUNT(*) as total_queries FROM user_queries;
    `);
    
    console.log('\n🎯 執行步驟:');
    console.log('1. 登入 https://supabase.com/dashboard');
    console.log('2. 選擇你的項目');
    console.log('3. 進入 SQL Editor');
    console.log('4. 複製上面的SQL並執行');
    console.log('5. 返回應用程序並刷新頁面');
    
    // 嘗試檢查表是否存在
    console.log('\n🔍 檢查現有表結構...');
    
    try {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('*')
        .limit(1);
      
      if (usersError) {
        console.log('❌ users表不存在:', usersError.message);
      } else {
        console.log('✅ users表存在');
      }
    } catch (err) {
      console.log('❌ 檢查users表時出錯:', err.message);
    }
    
    try {
      const { data: sessions, error: sessionsError } = await supabase
        .from('sessions')
        .select('*')
        .limit(1);
      
      if (sessionsError) {
        console.log('❌ sessions表不存在:', sessionsError.message);
      } else {
        console.log('✅ sessions表存在');
      }
    } catch (err) {
      console.log('❌ 檢查sessions表時出錯:', err.message);
    }
    
    try {
      const { data: queries, error: queriesError } = await supabase
        .from('user_queries')
        .select('*')
        .limit(1);
      
      if (queriesError) {
        console.log('❌ user_queries表不存在:', queriesError.message);
      } else {
        console.log('✅ user_queries表存在');
      }
    } catch (err) {
      console.log('❌ 檢查user_queries表時出錯:', err.message);
    }
    
  } catch (err) {
    console.log('❌ 創建表時出錯:', err.message);
  }
}

createTablesInSupabase();
