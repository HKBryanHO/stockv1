@echo off
echo ========================================
echo    將Bryanho帳戶設置為管理員
echo ========================================
echo.

echo 檢查.env文件...
if not exist .env (
    echo 複製環境配置文件...
    copy env.example .env
)

echo.
echo 更新環境變數設置...
echo.

REM 創建臨時文件來更新.env
(
echo # ===========================================
echo # 股票數據 API 配置 (按優先級排序)
echo # ===========================================
echo.
echo # 1. Finnhub API (推薦 - 最穩定，每分鐘60次調用)
echo # 註冊: https://finnhub.io/register
echo FINNHUB_API_KEY=your_finnhub_api_key_here
echo.
echo # 2. Financial Modeling Prep API (基本面數據)
echo # 註冊: https://financialmodelingprep.com/developer/docs
echo FMP_API_KEY=your_fmp_api_key_here
echo.
echo # 3. Polygon.io API (美股專業數據)
echo # 註冊: https://polygon.io/
echo POLYGON_API_KEY=your_polygon_api_key_here
echo.
echo # 4. Alpha Vantage API (備用數據源)
echo # 註冊: https://www.alphavantage.co/support/#api-key
echo ALPHA_VANTAGE_KEY=your_alpha_vantage_api_key_here
echo.
echo # Server Configuration
echo PORT=3001
echo NODE_ENV=production
echo.
echo # Redis Configuration
echo REDIS_URL=redis://localhost:6379
echo.
echo # CORS Configuration (for production)
echo ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
echo.
echo # Rate Limiting
echo RATE_LIMIT_WINDOW_MS=900000
echo RATE_LIMIT_MAX_REQUESTS=100
echo.
echo # Monitoring
echo ENABLE_MONITORING=true
echo MONITOR_INTERVAL_MS=300000
echo.
echo # xAI Grok API Configuration
echo # XAI_API_BASE can be left empty to use provider default
echo XAI_API_KEY=
echo XAI_API_BASE=
echo XAI_MODEL=
echo.
echo # Authentication (Multi-User System)
echo # 將Bryanho設置為管理員帳戶
echo AUTH_USER=Bryanho
echo AUTH_PASSWORD=Testlab1234!
echo.
echo # Database Configuration for Multi-User System
echo # SQLite database path (default: database/users.db)
echo USER_DB_PATH=database/users.db
echo.
echo # Session Configuration
echo # Session lifetime in ms (default 12h)
echo SESSION_TTL_MS=43200000
echo.
echo # User Registration Settings
echo # Enable user registration (true/false)
echo ENABLE_USER_REGISTRATION=true
echo.
echo # Default user role for new registrations (user/admin/premium)
echo DEFAULT_USER_ROLE=user
echo.
echo # Default API quota for new users
echo DEFAULT_API_QUOTA=1000
echo.
echo # Password Requirements
echo # Minimum password length
echo MIN_PASSWORD_LENGTH=6
echo.
echo # Rate Limiting for Authentication
echo # Max login attempts per IP per window
echo MAX_LOGIN_ATTEMPTS=5
echo # Login attempt window in minutes
echo LOGIN_ATTEMPT_WINDOW=15
echo.
echo # Perplexity API (LLM provider)
echo PERPLEXITY_API_KEY=
echo PERPLEXITY_MODEL=sonar-pro
) > .env

echo ✅ 環境變數已更新！
echo.
echo 📋 管理員帳戶信息:
echo    用戶名: Bryanho
echo    密碼: Testlab1234!
echo    角色: 管理員 (admin)
echo.
echo 🚀 現在您可以:
echo    1. 使用 Bryanho / Testlab1234! 登入
echo    2. 登入後會看到"用戶管理"標籤
echo    3. 可以管理所有用戶和權限
echo.
echo 按任意鍵繼續...
pause > nul


