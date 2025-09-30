# 🔑 API Keys 配置指南

## 問題診斷
您的系統目前使用模擬數據，因為缺少專業金融 API keys。

## 免費 API Keys 獲取

### 1. **Finnhub API (推薦 - 最穩定)**
- 🌐 註冊: https://finnhub.io/register
- 📊 免費額度: 60 calls/minute
- 🔑 獲取 API Key 後設置:
```bash
FINNHUB_API_KEY=your_finnhub_key_here
```

### 2. **Financial Modeling Prep (FMP)**
- 🌐 註冊: https://financialmodelingprep.com/developer/docs
- 📊 免費額度: 250 calls/day
- 🔑 獲取 API Key 後設置:
```bash
FMP_API_KEY=your_fmp_key_here
```

### 3. **Polygon.io**
- 🌐 註冊: https://polygon.io/
- 📊 免費額度: 5 calls/minute
- 🔑 獲取 API Key 後設置:
```bash
POLYGON_API_KEY=your_polygon_key_here
```

## 配置方法

### 本地開發
1. 複製 `env.example` 到 `.env`
2. 填入您的 API keys
3. 重啟服務器

### Render.com 部署
1. 進入 Render Dashboard
2. 選擇您的服務
3. 進入 Environment 頁面
4. 添加環境變量:
   - `FINNHUB_API_KEY`
   - `FMP_API_KEY` 
   - `POLYGON_API_KEY`

## 驗證配置
配置完成後，您應該看到:
```
✅ FMP: 獲取到 180 條記錄
✅ Finnhub: 獲取到實時價格 $XXX.XX
✅ Polygon: 獲取到 180 條記錄
```

而不是:
```
✓ Simulated: Retrieved 181 days of data
```

## 優先級
1. **Finnhub** - 最穩定，實時數據最好
2. **FMP** - 基本面數據最全面
3. **Polygon.io** - 美股專業數據

## 故障排除
如果仍然看到模擬數據:
1. 檢查 API key 是否正確
2. 檢查 API key 是否有效
3. 重啟服務器
4. 檢查網絡連接
