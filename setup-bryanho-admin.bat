@echo off
echo 🔧 設置 Bryanho 管理員帳戶...
echo.

REM 檢查 Node.js 是否可用
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js 未找到，請確保 Node.js 已安裝並在 PATH 中
    echo 或者您可以在 Render 部署中運行此腳本
    pause
    exit /b 1
)

echo ✅ 找到 Node.js，開始設置...
echo.

REM 運行設置腳本
node setup-bryanho-admin.js

if %errorlevel% equ 0 (
    echo.
    echo ✅ 設置完成！
    echo.
    echo 📋 下一步：
    echo 1. 啟動服務器: npm start 或 node server.js
    echo 2. 訪問登入頁面: http://localhost:3001/login.html
    echo 3. 使用 Bryanho / Bryanho123 登入
    echo 4. 訪問管理頁面: http://localhost:3001/admin.html
) else (
    echo.
    echo ❌ 設置失敗，請檢查錯誤訊息
)

echo.
pause
