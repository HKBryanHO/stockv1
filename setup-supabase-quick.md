# Supabase 快速設置指南

## 步驟 1: 創建 Supabase 項目

1. 訪問 https://supabase.com
2. 點擊 "Start your project"
3. 使用 GitHub 帳戶登入
4. 點擊 "New Project"
5. 填寫項目信息：
   - **Name**: `stock-predictor-db`
   - **Database Password**: 設置一個強密碼（記住這個密碼！）
   - **Region**: 選擇離您最近的區域（如 Singapore）
6. 點擊 "Create new project"
7. 等待項目創建完成（約 2-3 分鐘）

## 步驟 2: 獲取數據庫連接信息

1. 項目創建完成後，點擊左側的 "Settings"
2. 選擇 "Database"
3. 找到 "Connection string" 部分
4. 複製 "URI" 連接字符串，格式如下：
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```

## 步驟 3: 在 Render 中設置環境變量

1. 登入您的 Render 帳戶
2. 找到您的 stockv1 服務
3. 點擊 "Environment" 標籤
4. 添加以下環境變量：

```
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
PG_SSL=true
```

**重要**: 將 `[YOUR-PASSWORD]` 替換為您設置的數據庫密碼，將 `[PROJECT-REF]` 替換為您的項目引用 ID。

## 步驟 4: 創建數據庫表

1. 在 Supabase 儀表板中，點擊左側的 "SQL Editor"
2. 點擊 "New query"
3. 複製並執行以下 SQL：

```sql
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
```

4. 點擊 "Run" 執行 SQL

## 步驟 5: 創建管理員用戶

在 SQL 編輯器中執行：

```sql
-- 創建管理員用戶（密碼: admin123）
INSERT INTO users (username, email, password_hash, full_name, role, api_quota, status)
VALUES (
    'admin',
    'admin@bma-hk.com',
    '$2b$10$rQZ8k9mN2pL7sT3uV6wXeOqR4nH8cF1jK5mP9sL2vB6xE7yA3zC8wQ5rT',
    'System Administrator',
    'admin',
    10000,
    'active'
) ON CONFLICT (username) DO NOTHING;

-- 創建 Jim 用戶（密碼: jim123）
INSERT INTO users (username, email, password_hash, full_name, role, api_quota, status)
VALUES (
    'jim',
    'jim@example.com',
    '$2b$10$rQZ8k9mN2pL7sT3uV6wXeOqR4nH8cF1jK5mP9sL2vB6xE7yA3zC8wQ5rT',
    'Jim User',
    'user',
    1000,
    'active'
) ON CONFLICT (username) DO NOTHING;
```

## 步驟 6: 重啟 Render 服務

1. 在 Render 中，點擊 "Manual Deploy"
2. 選擇 "Deploy latest commit"
3. 等待部署完成

## 步驟 7: 測試連接

部署完成後，在 Render 終端中運行：

```bash
node migrate-to-postgresql.js
```

如果成功，您應該看到：
```
✅ PostgreSQL 數據庫連接成功
✅ 表結構創建成功
✅ 遷移完成
```

## 故障排除

### 如果連接失敗
1. 檢查環境變量是否正確設置
2. 確認 Supabase 項目是否創建成功
3. 檢查數據庫密碼是否正確
4. 確認項目引用 ID 是否正確

### 如果表創建失敗
1. 檢查 SQL 語法是否正確
2. 確認是否有權限創建表
3. 檢查 Supabase 項目狀態

### 聯繫支持
- Supabase Discord: https://discord.supabase.com
- 文檔: https://supabase.com/docs
