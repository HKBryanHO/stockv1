@echo off
echo ========================================
echo 🔧 API 配置助手
echo ========================================

echo.
echo 📋 請按照以下步驟配置 API 金鑰：
echo.

echo 1. 編輯 .env 文件
echo 2. 添加以下 API 金鑰：
echo.
echo # 主要數據源 (推薦)
echo FINNHUB_API_KEY=你的_finnhub_金鑰
echo FMP_API_KEY=你的_fmp_金鑰
echo.
echo # AI 推薦系統
echo PERPLEXITY_API_KEY=你的_perplexity_金鑰
echo.
echo # 備用數據源 (可選)
echo POLYGON_API_KEY=你的_polygon_金鑰
echo ALPHA_VANTAGE_KEY=你的_alpha_vantage_金鑰
echo.

echo 🔑 獲取免費 API 金鑰：
echo.
echo 1. Finnhub (推薦): https://finnhub.io/register
echo    - 每分鐘60次調用
echo    - 全球股票數據
echo.
echo 2. FMP: https://financialmodelingprep.com/developer/docs
echo    - 每天250次調用
echo    - 基本面數據
echo.
echo 3. Perplexity: https://www.perplexity.ai/settings/api
echo    - AI 推薦系統
echo.

echo 📝 配置完成後，重啟服務器：
echo    .\start.bat
echo.

pause
