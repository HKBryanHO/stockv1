@echo off
echo ========================================
echo 🚀 股票數據 API 快速設置
echo ========================================

echo.
echo 📋 正在檢查配置文件...

if not exist ".env" (
    echo 📝 創建 .env 文件...
    copy env.example .env
    echo ✅ .env 文件已創建
) else (
    echo ✅ .env 文件已存在
)

echo.
echo 🔑 請在 .env 文件中配置以下 API 金鑰：
echo.
echo 1. Finnhub API (推薦): https://finnhub.io/register
echo 2. FMP API: https://financialmodelingprep.com/developer/docs
echo 3. Polygon.io API: https://polygon.io/
echo 4. Alpha Vantage API: https://www.alphavantage.co/support/#api-key
echo.
echo 📖 詳細設置指南請查看: API_SETUP_GUIDE.md
echo.

echo 🧪 測試 API 配置...
echo.
echo 請先配置 API 金鑰，然後運行以下命令測試：
echo.
echo curl "http://localhost:3001/api/debug/env"
echo curl "http://localhost:3001/api/quote/enhanced?symbol=AAPL"
echo.

echo 🎯 推薦最小配置：
echo FINNHUB_API_KEY=你的_finnhub_金鑰
echo FMP_API_KEY=你的_fmp_金鑰
echo.

pause
