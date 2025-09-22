# Yahoo Finance API 替代方案

## 問題分析
Yahoo Finance 在 2017 年停止官方 API 服務，2024-2025 年開始嚴格限制非官方端點訪問。

## 替代方案

### 1. Alpha Vantage (推薦)
- **優點**: 免費、穩定、官方支持
- **限制**: 每分鐘 5 次請求（免費版）
- **數據**: 實時價格、歷史數據、技術指標
- **API Key**: 需要註冊獲取

### 2. Twelve Data
- **優點**: 實時數據、易於使用
- **限制**: 免費版每日 800 次請求
- **數據**: 股票、外匯、加密貨幣、ETF
- **API Key**: 需要註冊獲取

### 3. Polygon.io
- **優點**: 準確的實時數據
- **限制**: 免費版有限制
- **數據**: 美國股票、期權、外匯、加密貨幣
- **API Key**: 需要註冊獲取

### 4. EOD Historical Data
- **優點**: 全球交易所覆蓋
- **限制**: 免費版有限制
- **數據**: 歷史和基本面數據
- **API Key**: 需要註冊獲取

## 立即可用的解決方案

### 方案 1: 使用 Alpha Vantage
```javascript
// 替換 Yahoo Finance API 調用
const ALPHA_VANTAGE_KEY = 'YOUR_API_KEY';
const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`;
```

### 方案 2: 使用 Twelve Data
```javascript
const TWELVE_DATA_KEY = 'YOUR_API_KEY';
const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1day&apikey=${TWELVE_DATA_KEY}`;
```

### 方案 3: 使用免費的 IEX Cloud
```javascript
const IEX_TOKEN = 'YOUR_TOKEN';
const url = `https://cloud.iexapis.com/stable/stock/${symbol}/chart/6m?token=${IEX_TOKEN}`;
```

## 建議實施步驟

1. **短期**: 使用現有的模擬數據功能
2. **中期**: 註冊 Alpha Vantage 免費 API
3. **長期**: 考慮付費 API 服務以獲得更好的數據質量

## 免費 API Key 獲取

### Alpha Vantage
1. 訪問: https://www.alphavantage.co/support/#api-key
2. 填寫表格獲取免費 API Key
3. 每分鐘 5 次請求限制

### Twelve Data
1. 訪問: https://twelvedata.com/pricing
2. 註冊免費帳戶
3. 每日 800 次請求限制

### IEX Cloud
1. 訪問: https://iexcloud.io/pricing/
2. 註冊免費帳戶
3. 每月 50,000 次請求限制
