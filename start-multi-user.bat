@echo off
echo ========================================
echo    股票預測系統 - 多用戶版本啟動
echo ========================================
echo.

echo 檢查依賴...
if not exist node_modules (
    echo 安裝依賴包...
    npm install
    if errorlevel 1 (
        echo 依賴安裝失敗！
        pause
        exit /b 1
    )
)

echo.
echo 檢查數據庫...
if not exist database\users.db (
    echo 設置多用戶系統...
    node setup-multi-user.js
    if errorlevel 1 (
        echo 設置失敗！
        pause
        exit /b 1
    )
)

echo.
echo 檢查環境配置...
if not exist .env (
    echo 複製環境配置...
    copy env.example .env
    echo 請編輯 .env 文件設置您的 API 密鑰！
    echo.
)

echo 啟動服務器...
echo.
echo 默認管理員帳戶:
echo   用戶名: admin
echo   密碼: admin123
echo   ⚠️  請在首次登入後立即修改密碼！
echo.
echo 訪問地址:
echo   主頁: http://localhost:3001
echo   登入: http://localhost:3001/login
echo   註冊: http://localhost:3001/register
echo   管理: http://localhost:3001/admin
echo.
echo 按 Ctrl+C 停止服務器
echo ========================================
echo.

npm start
