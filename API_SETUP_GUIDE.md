# 🚀 股票數據 API 配置指南

## 📋 快速設置步驟

### 1. 複製環境配置文件
```bash
cp env.example .env
```

### 2. 獲取 API 金鑰

#### 🔥 **Finnhub API (強烈推薦)**
- **註冊**: https://finnhub.io/register
- **免費額度**: 每分鐘60次調用
- **數據類型**: 實時股價、新聞、基本面
- **全球覆蓋**: 60+ 交易所
- **穩定性**: ⭐⭐⭐⭐⭐

#### 📊 **Financial Modeling Prep (FMP)**
- **註冊**: https://financialmodelingprep.com/developer/docs
- **免費額度**: 每天250次調用
- **數據類型**: 基本面、財務報表、歷史數據
- **全球覆蓋**: 全球主要交易所
- **穩定性**: ⭐⭐⭐⭐

#### 🎯 **Polygon.io (美股專業)**
- **註冊**: https://polygon.io/
- **免費額度**: 每分鐘5次調用
- **數據類型**: 美股、期權、指數
- **全球覆蓋**: 僅美股
- **穩定性**: ⭐⭐⭐⭐

#### 🔄 **Alpha Vantage (備用)**
- **註冊**: https://www.alphavantage.co/support/#api-key
- **免費額度**: 每分鐘5次調用
- **數據類型**: 股價、技術指標
- **全球覆蓋**: 全球主要交易所
- **穩定性**: ⭐⭐⭐

### 3. 配置 .env 文件

編輯 `.env` 文件，填入你的 API 金鑰：

```bash
# 主要數據源 (推薦配置)
FINNHUB_API_KEY=你的_finnhub_金鑰
FMP_API_KEY=你的_fmp_金鑰

# 備用數據源 (可選)
POLYGON_API_KEY=你的_polygon_金鑰
ALPHA_VANTAGE_KEY=你的_alpha_vantage_金鑰
```

## 🎯 推薦配置方案

### 方案一：最小配置 (只需2個API)
```bash
FINNHUB_API_KEY=你的_finnhub_金鑰
FMP_API_KEY=你的_fmp_金鑰
```

### 方案二：完整配置 (最佳體驗)
```bash
FINNHUB_API_KEY=你的_finnhub_金鑰
FMP_API_KEY=你的_fmp_金鑰
POLYGON_API_KEY=你的_polygon_金鑰
ALPHA_VANTAGE_KEY=你的_alpha_vantage_金鑰
```

## 🔧 測試 API 配置

### 1. 啟動服務器
```bash
npm start
# 或
node server.js
```

### 2. 測試 API 端點
```bash
# 測試 Finnhub
curl "http://localhost:3001/api/finnhub/quote?symbol=AAPL"

# 測試 FMP
curl "http://localhost:3001/api/fmp/quote?symbol=AAPL"

# 測試增強版端點 (自動選擇最佳API)
curl "http://localhost:3001/api/quote/enhanced?symbol=AAPL"

# 測試市場預測頁面
curl "http://localhost:3001/api/market/insights?symbols=AAPL,MSFT,GOOGL"
```

### 3. 檢查 API 狀態
```bash
# 檢查所有 API 配置狀態
curl "http://localhost:3001/api/debug/env"
```

## 🚨 故障排除

### 問題1：API 金鑰無效
```bash
# 檢查 .env 文件是否存在
ls -la .env

# 檢查環境變數是否載入
echo $FINNHUB_API_KEY
```

### 問題2：API 調用失敗
```bash
# 檢查服務器日誌
tail -f server.log

# 測試單個 API
curl -v "https://finnhub.io/api/v1/quote?symbol=AAPL&token=你的金鑰"
```

### 問題3：市場預測頁面無數據
1. 確認所有 API 金鑰已配置
2. 檢查網絡連接
3. 查看瀏覽器控制台錯誤
4. 測試 `/api/market/insights` 端點

## 📈 API 使用建議

### 優先級順序
1. **Finnhub** - 實時數據，穩定性最高
2. **FMP** - 基本面數據，財務分析
3. **Polygon.io** - 美股專業數據
4. **Alpha Vantage** - 備用數據源

### 成本優化
- 免費版足夠個人使用
- 付費版適合商業應用
- 建議先使用免費版測試

## 🎉 完成設置後

1. 重啟服務器
2. 訪問市場預測頁面
3. 檢查股票數據是否正常載入
4. 測試不同股票代號

---

**需要幫助？** 請檢查服務器日誌或聯繫技術支援。
