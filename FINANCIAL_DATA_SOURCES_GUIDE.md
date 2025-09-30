# 📊 金融數據源配置指南

本指南說明如何配置和使用專業金融數據源：Polygon.io、Finnhub、FMP (Financial Modeling Prep)。

## 🔑 **API 密鑰獲取**

### 1. **FMP (Financial Modeling Prep) - 推薦**
- **官網**：https://financialmodelingprep.com/
- **免費額度**：250 次請求/天
- **付費計劃**：$14/月起
- **註冊步驟**：
  1. 訪問官網，點擊 "Get Started Free"
  2. 填寫註冊信息
  3. 驗證郵箱
  4. 在 Dashboard 中獲取 API Key

### 2. **Polygon.io**
- **官網**：https://polygon.io/
- **免費額度**：5 次請求/分鐘
- **付費計劃**：$99/月起
- **註冊步驟**：
  1. 訪問官網，點擊 "Get Started"
  2. 選擇免費計劃
  3. 填寫註冊信息
  4. 在 Dashboard 中獲取 API Key

### 3. **Finnhub**
- **官網**：https://finnhub.io/
- **免費額度**：60 次請求/分鐘
- **付費計劃**：$9/月起
- **註冊步驟**：
  1. 訪問官網，點擊 "Get Free API Key"
  2. 填寫註冊信息
  3. 驗證郵箱
  4. 在 Dashboard 中獲取 API Key

## ⚙️ **環境變量配置**

### 創建 `.env` 文件
```bash
# 在項目根目錄創建 .env 文件
touch .env
```

### 添加 API 密鑰
```env
# 金融數據源 API 密鑰
FMP_API_KEY=your_fmp_api_key_here
POLYGON_API_KEY=your_polygon_api_key_here
FINNHUB_API_KEY=your_finnhub_api_key_here

# 可選：Alpha Vantage (備用)
ALPHA_VANTAGE_KEY=your_alpha_vantage_key_here
```

### 安裝 dotenv 包
```bash
npm install dotenv
```

## 🚀 **快速開始**

### 1. **配置 API 密鑰**
```bash
# 複製環境變量模板
cp env.example .env

# 編輯 .env 文件，添加您的 API 密鑰
nano .env
```

### 2. **測試數據源**
```bash
# 測試 FMP API
node -e "
const FinancialDataSources = require('./financial_data_sources');
const dataSource = new FinancialDataSources();
dataSource.getHistoricalData('AAPL', 30).then(result => {
  console.log('FMP 測試結果:', result);
});
"

# 測試 Polygon API
node -e "
const FinancialDataSources = require('./financial_data_sources');
const dataSource = new FinancialDataSources();
dataSource.getRealtimeData('AAPL').then(result => {
  console.log('Polygon 測試結果:', result);
});
"
```

### 3. **啟動應用**
```bash
# 啟動後端服務器
node server.js

# 在另一個終端啟動前端服務器
cd public && python -m http.server 8080
```

## 📊 **數據源特性對比**

| 數據源 | 免費額度 | 實時數據 | 歷史數據 | 全球市場 | 推薦度 |
|--------|----------|----------|----------|----------|--------|
| **FMP** | 250次/天 | ✅ | ✅ | ✅ | ⭐⭐⭐⭐⭐ |
| **Polygon** | 5次/分鐘 | ✅ | ✅ | 美股為主 | ⭐⭐⭐⭐ |
| **Finnhub** | 60次/分鐘 | ✅ | ✅ | 全球 | ⭐⭐⭐⭐ |
| **yfinance** | 無限制 | ❌ | ✅ | 全球 | ⭐⭐⭐ |

## 🔧 **高級配置**

### 1. **數據源優先級設置**
```javascript
// 在 financial_data_sources.js 中修改優先級
class FinancialDataSources {
    constructor() {
        // 設置數據源優先級
        this.priority = ['fmp', 'polygon', 'finnhub', 'yfinance'];
    }
}
```

### 2. **請求頻率限制**
```javascript
// 添加請求頻率限制
const rateLimiter = {
    fmp: { requests: 0, resetTime: Date.now() + 86400000 }, // 24小時
    polygon: { requests: 0, resetTime: Date.now() + 60000 }, // 1分鐘
    finnhub: { requests: 0, resetTime: Date.now() + 60000 }  // 1分鐘
};
```

### 3. **錯誤處理和重試**
```javascript
// 添加重試機制
async function fetchWithRetry(url, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await makeRequest(url);
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
}
```

## 📈 **使用示例**

### 1. **獲取歷史數據**
```javascript
const FinancialDataSources = require('./financial_data_sources');
const dataSource = new FinancialDataSources();

// 獲取 AAPL 過去一年的數據
const result = await dataSource.getHistoricalData('AAPL', 365);
console.log(`數據源: ${result.source}`);
console.log(`數據條數: ${result.count}`);
```

### 2. **獲取實時數據**
```javascript
// 獲取 AAPL 實時價格
const result = await dataSource.getRealtimeData('AAPL');
console.log(`當前價格: $${result.data.price}`);
console.log(`數據源: ${result.source}`);
```

### 3. **批量獲取多隻股票**
```javascript
const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN'];
const results = await Promise.all(
    symbols.map(symbol => dataSource.getRealtimeData(symbol))
);
```

## 🛠️ **故障排除**

### 常見問題

**1. API 密鑰無效**
```bash
# 檢查環境變量
echo $FMP_API_KEY
echo $POLYGON_API_KEY
echo $FINNHUB_API_KEY
```

**2. 請求頻率超限**
```bash
# 檢查 API 使用情況
# FMP: 在 Dashboard 中查看使用量
# Polygon: 檢查請求日誌
# Finnhub: 查看 API 使用統計
```

**3. 數據格式錯誤**
```javascript
// 檢查數據格式
console.log('原始數據:', rawData);
console.log('處理後數據:', processedData);
```

### 調試模式
```javascript
// 啟用詳細日誌
process.env.DEBUG = 'financial-data-sources';

// 查看請求詳情
const dataSource = new FinancialDataSources();
dataSource.debug = true;
```

## 💰 **成本優化建議**

### 1. **免費額度管理**
- **FMP**: 250次/天，適合開發測試
- **Polygon**: 5次/分鐘，適合實時數據
- **Finnhub**: 60次/分鐘，適合高頻請求

### 2. **數據緩存**
```javascript
// 實現數據緩存
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5分鐘

function getCachedData(key) {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }
    return null;
}
```

### 3. **請求優化**
```javascript
// 批量請求優化
async function batchRequest(symbols) {
    const batchSize = 10;
    const batches = [];
    
    for (let i = 0; i < symbols.length; i += batchSize) {
        batches.push(symbols.slice(i, i + batchSize));
    }
    
    const results = await Promise.all(
        batches.map(batch => fetchBatchData(batch))
    );
    
    return results.flat();
}
```

## 📚 **API 文檔參考**

- **FMP API**: https://financialmodelingprep.com/developer/docs
- **Polygon API**: https://polygon.io/docs
- **Finnhub API**: https://finnhub.io/docs/api
- **yfinance**: https://github.com/ranaroussi/yfinance

## 🆘 **技術支持**

### 官方支持
- **FMP**: support@financialmodelingprep.com
- **Polygon**: support@polygon.io
- **Finnhub**: support@finnhub.io

### 社區支持
- **GitHub Issues**: 在項目倉庫中提交問題
- **Stack Overflow**: 搜索相關標籤
- **Reddit**: r/algotrading, r/investing

---

**🎉 配置完成後，您的交易系統就可以使用專業的金融數據源了！**

如果您在配置過程中遇到任何問題，請參考故障排除部分或聯繫技術支持。
