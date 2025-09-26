# 多用戶系統使用指南

## 🎯 概述

本股票預測系統現已升級支持多用戶功能，包括用戶註冊、身份驗證、權限管理和個人化設置。

## 🚀 快速開始

### 1. 安裝依賴

```bash
npm install
```

### 2. 設置多用戶系統

```bash
node setup-multi-user.js
```

這個腳本會：
- 創建數據庫目錄和表結構
- 創建默認管理員帳戶
- 可選創建示例用戶

### 3. 配置環境變數

複製並編輯環境配置文件：

```bash
cp env.example .env
```

編輯 `.env` 文件，設置必要的配置：

```bash
# 多用戶系統配置
USER_DB_PATH=database/users.db
ENABLE_USER_REGISTRATION=true
DEFAULT_USER_ROLE=user
DEFAULT_API_QUOTA=1000
MIN_PASSWORD_LENGTH=6
```

### 4. 啟動服務器

```bash
npm start
```

### 5. 訪問系統

- 主頁面: http://localhost:3001
- 登入頁面: http://localhost:3001/login
- 註冊頁面: http://localhost:3001/register
- 管理後台: http://localhost:3001/admin (需要管理員權限)

## 👥 用戶角色系統

### 用戶角色

| 角色 | 權限 | 描述 |
|------|------|------|
| `admin` | 完全訪問 | 系統管理員，可以管理所有用戶 |
| `premium` | 高級功能 | 高級用戶，擁有更高的API配額 |
| `user` | 基本功能 | 普通用戶，基本股票預測功能 |

### 權限對比

| 功能 | User | Premium | Admin |
|------|------|---------|-------|
| 股票預測 | ✅ | ✅ | ✅ |
| 個人資料管理 | ✅ | ✅ | ✅ |
| API配額 | 1000/月 | 5000/月 | 10000/月 |
| 用戶管理 | ❌ | ❌ | ✅ |
| 系統設置 | ❌ | ❌ | ✅ |

## 🔐 身份驗證系統

### 用戶註冊

1. 訪問 `/register` 頁面
2. 填寫註冊信息：
   - 用戶名（唯一）
   - 電子郵箱（唯一）
   - 密碼（至少6個字符）
   - 姓名（可選）
3. 點擊註冊按鈕
4. 註冊成功後自動跳轉到登入頁面

### 用戶登入

1. 訪問 `/login` 頁面
2. 輸入用戶名和密碼
3. 登入成功後跳轉到股票預測器

### 會話管理

- 會話有效期：12小時（可配置）
- 會話存儲：數據庫 + 內存備份
- 自動清理：過期會話自動刪除

## 👤 用戶管理

### 管理員功能

管理員可以通過 `/admin` 頁面進行以下操作：

#### 用戶列表管理
- 查看所有用戶信息
- 分頁瀏覽用戶
- 搜索和篩選用戶

#### 用戶操作
- **編輯用戶**：修改角色、狀態、API配額
- **刪除用戶**：軟刪除（設為非活躍狀態）
- **查看統計**：用戶總數、活躍用戶、最近登入等

#### 用戶狀態
- `active`：活躍用戶，可以正常使用系統
- `inactive`：非活躍用戶，無法登入
- `suspended`：被暫停的用戶

### 用戶個人資料

每個用戶都可以：
- 查看個人資料
- 修改姓名和郵箱
- 查看API使用情況
- 管理個人設置

## 📊 API 配額系統

### 配額管理

- **默認配額**：普通用戶 1000 次/月
- **高級配額**：高級用戶 5000 次/月
- **管理員配額**：10000 次/月
- **使用統計**：實時顯示API使用情況

### 配額監控

系統會自動追蹤每個用戶的API使用情況：
- 股票數據查詢
- 預測模型調用
- 新聞分析請求
- 其他API調用

## 🗄️ 數據庫結構

### 主要表結構

#### users 表
```sql
- id: 用戶ID (主鍵)
- username: 用戶名 (唯一)
- email: 電子郵箱 (唯一)
- password_hash: 加密密碼
- full_name: 姓名
- role: 用戶角色
- status: 用戶狀態
- created_at: 創建時間
- last_login: 最後登入時間
- api_quota: API配額
- api_usage: API使用量
```

#### user_sessions 表
```sql
- id: 會話ID (主鍵)
- user_id: 用戶ID (外鍵)
- session_token: 會話令牌
- expires_at: 過期時間
- ip_address: IP地址
- user_agent: 用戶代理
```

#### user_portfolios 表
```sql
- id: 組合ID (主鍵)
- user_id: 用戶ID (外鍵)
- name: 組合名稱
- holdings: 持倉信息 (JSON)
- is_default: 是否為默認組合
```

#### user_predictions 表
```sql
- id: 預測ID (主鍵)
- user_id: 用戶ID (外鍵)
- symbol: 股票代碼
- prediction_data: 預測數據 (JSON)
- model_used: 使用的模型
- confidence_score: 置信度分數
```

## 🔧 API 端點

### 身份驗證端點

```
POST /api/users/register          # 用戶註冊
POST /auth/login                  # 用戶登入
POST /auth/logout                 # 用戶登出
GET  /api/users/profile           # 獲取個人資料
PUT  /api/users/profile           # 更新個人資料
```

### 管理員端點

```
GET    /api/admin/users           # 獲取用戶列表
PUT    /api/admin/users/:id       # 更新用戶信息
DELETE /api/admin/users/:id       # 刪除用戶
```

## 🛡️ 安全特性

### 密碼安全
- 使用 bcrypt 加密存儲密碼
- 密碼強度檢查
- 最少6個字符要求

### 會話安全
- HttpOnly Cookie
- 安全的會話令牌
- 自動過期清理
- IP地址記錄

### 權限控制
- 基於角色的訪問控制 (RBAC)
- 管理員權限驗證
- API端點保護

### 輸入驗證
- 用戶名和郵箱唯一性檢查
- 郵箱格式驗證
- SQL注入防護
- XSS防護

## 📈 性能優化

### 數據庫優化
- 索引優化
- 查詢優化
- 連接池管理

### 緩存策略
- 會話緩存
- 用戶信息緩存
- API響應緩存

### 監控和日誌
- 用戶活動日誌
- API使用統計
- 錯誤監控

## 🚨 故障排除

### 常見問題

#### 1. 數據庫連接失敗
```bash
# 檢查數據庫文件是否存在
ls -la database/users.db

# 重新設置數據庫
node setup-multi-user.js
```

#### 2. 用戶無法註冊
- 檢查 `ENABLE_USER_REGISTRATION` 設置
- 確認數據庫權限
- 查看服務器日誌

#### 3. 會話過期問題
- 檢查 `SESSION_TTL_MS` 設置
- 確認系統時間正確
- 清理過期會話

#### 4. 權限問題
- 確認用戶角色設置
- 檢查管理員權限
- 驗證會話狀態

### 日誌查看

```bash
# 查看服務器日誌
tail -f server.log

# 查看數據庫操作
sqlite3 database/users.db
.mode column
.headers on
SELECT * FROM users;
```

## 🔄 升級和遷移

### 從單用戶系統升級

1. **備份現有數據**
   ```bash
   cp -r database database_backup
   ```

2. **運行升級腳本**
   ```bash
   node setup-multi-user.js
   ```

3. **更新環境配置**
   - 複製新的 `.env` 配置
   - 設置多用戶相關參數

4. **重啟服務**
   ```bash
   npm start
   ```

### 數據遷移

如果需要從其他系統遷移用戶數據：

```javascript
// 遷移腳本示例
const UserManager = require('./auth/userManager');
const userManager = new UserManager();

// 批量創建用戶
async function migrateUsers(oldUsers) {
  for (const user of oldUsers) {
    await userManager.createUser({
      username: user.username,
      email: user.email,
      password: user.password, // 需要重新加密
      fullName: user.name,
      role: user.role || 'user'
    });
  }
}
```

## 📞 支持和維護

### 定期維護任務

1. **數據庫維護**
   - 清理過期會話
   - 備份用戶數據
   - 優化數據庫性能

2. **安全檢查**
   - 審查用戶權限
   - 檢查異常登入
   - 更新安全配置

3. **性能監控**
   - 監控API使用量
   - 檢查系統負載
   - 優化查詢性能

### 聯繫支持

如果遇到問題，請：
1. 檢查本文檔的故障排除部分
2. 查看服務器日誌
3. 檢查數據庫狀態
4. 聯繫技術支持團隊

---

## 🎉 結語

多用戶系統為您的股票預測平台提供了完整的用戶管理功能，支持用戶註冊、權限控制、個人化設置等特性。通過本指南，您應該能夠順利設置和使用多用戶系統。

如有任何問題或建議，歡迎聯繫開發團隊！
