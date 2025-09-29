-- Supabase 數據庫設置腳本
-- 在 Supabase Dashboard 的 SQL 編輯器中執行此腳本

-- 1. 創建 sessions 表
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

-- 2. 創建 user_queries 表
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
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_queries_username ON user_queries(username);
CREATE INDEX IF NOT EXISTS idx_user_queries_type ON user_queries(type);
CREATE INDEX IF NOT EXISTS idx_user_queries_created_at ON user_queries(created_at);

-- 4. 確保 admin 用戶存在且角色正確
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

-- 5. 檢查結果
SELECT 'Tables created successfully' as status;
SELECT username, role, status FROM users WHERE username = 'admin';
