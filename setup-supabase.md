# Supabase 設置指南

## 為什麼選擇 Supabase

### 優勢
✅ **免費額度充足**: 500MB 數據庫，足夠初期使用  
✅ **PostgreSQL**: 功能強大，性能優秀  
✅ **實時功能**: 支持實時數據同步  
✅ **自動備份**: 每日自動備份，保留 7 天  
✅ **管理界面**: 直觀的數據庫管理  
✅ **REST API**: 自動生成 REST API  
✅ **認證系統**: 內建用戶認證  
✅ **SSL 加密**: 所有連接都加密  

### 成本
- **免費方案**: 0 美元/月
  - 數據庫: 500MB
  - 帶寬: 2GB/月
  - API 請求: 50,000/月
  - 存儲: 1GB

## 設置步驟

### 1. 創建 Supabase 項目

1. 訪問 [Supabase](https://supabase.com)
2. 點擊 "Start your project"
3. 使用 GitHub 帳戶登入
4. 點擊 "New Project"
5. 填寫項目信息：
   - **Name**: `stock-predictor-db`
   - **Database Password**: 設置強密碼
   - **Region**: 選擇離用戶最近的區域
6. 點擊 "Create new project"
7. 等待項目創建完成（約 2 分鐘）

### 2. 獲取數據庫連接信息

1. 在項目儀表板中，點擊左側的 "Settings"
2. 選擇 "Database"
3. 找到 "Connection string" 部分
4. 複製 "URI" 連接字符串，格式如下：
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```

### 3. 設置環境變量

在您的 Render 部署中添加以下環境變量：

```bash
# PostgreSQL 連接配置
PG_USER=postgres
PG_HOST=db.[PROJECT-REF].supabase.co
PG_DATABASE=postgres
PG_PASSWORD=[YOUR-PASSWORD]
PG_PORT=5432
PG_SSL=true

# 或者使用完整的連接字符串
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

### 4. 安裝 PostgreSQL 驅動

在您的 `package.json` 中添加：

```json
{
  "dependencies": {
    "pg": "^8.11.3",
    "pg-pool": "^3.6.1"
  }
}
```

然後運行：
```bash
npm install
```

### 5. 創建數據庫表

使用 Supabase 的 SQL 編輯器創建表：

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

### 6. 創建管理員用戶

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
);

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
);
```

## 測試連接

### 使用 Node.js 測試

創建測試文件 `test-db-connection.js`：

```javascript
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('✅ 數據庫連接成功');
    
    const result = await client.query('SELECT COUNT(*) FROM users');
    console.log(`用戶數量: ${result.rows[0].count}`);
    
    client.release();
  } catch (err) {
    console.error('❌ 數據庫連接失敗:', err.message);
  } finally {
    await pool.end();
  }
}

testConnection();
```

運行測試：
```bash
node test-db-connection.js
```

## 備份策略

### 自動備份
- Supabase 自動每日備份
- 保留 7 天的備份
- 可以手動創建備份

### 手動備份
1. 在 Supabase 儀表板中，點擊 "Settings"
2. 選擇 "Database"
3. 在 "Backups" 部分點擊 "Download backup"

## 監控和維護

### 監控指標
- 數據庫大小
- 連接數
- 查詢性能
- 錯誤率

### 維護建議
- 定期檢查數據庫大小
- 監控慢查詢
- 優化索引
- 清理過期會話

## 故障排除

### 常見問題

1. **連接超時**
   - 檢查網絡連接
   - 確認 IP 白名單設置

2. **認證失敗**
   - 檢查用戶名和密碼
   - 確認 SSL 設置

3. **查詢超時**
   - 優化 SQL 查詢
   - 添加適當的索引

### 聯繫支持
- Supabase Discord: https://discord.supabase.com
- 文檔: https://supabase.com/docs
- GitHub: https://github.com/supabase/supabase

## 升級計劃

### 免費方案限制
- 數據庫: 500MB
- 帶寬: 2GB/月
- API 請求: 50,000/月

### 付費方案 ($25/月)
- 數據庫: 8GB
- 帶寬: 250GB/月
- API 請求: 無限制
- 存儲: 100GB
- 備份: 30 天

### 升級觸發條件
- 數據庫接近 500MB
- 帶寬接近 2GB/月
- 需要更多功能
