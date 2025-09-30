# 回測數據源配置指南

本系統現在支持多個高品質的金融數據源來進行回測分析。以下是配置指南：

## 🚀 推薦的數據源優先順序

1. **Financial Modeling Prep (FMP)** - 最推薦
2. **Finnhub** - 次推薦  
3. **Polygon.io** - 第三選擇
4. **Alpha Vantage** - 備用選項

## 📋 API 密鑰獲取

### 1. Financial Modeling Prep (FMP)
- **網站**: https://financialmodelingprep.com/
- **免費方案**: 250 請求/天
- **付費方案**: 從 $14.99/月 開始
- **優勢**: 數據品質高，響應快速，歷史數據完整
- **配置**: 在 `.env` 文件中添加 `FMP_API_KEY=your_key_here`

### 2. Finnhub
- **網站**: https://finnhub.io/
- **免費方案**: 60 請求/分鐘
- **付費方案**: 從 $9/月 開始
- **優勢**: 實時數據，全球市場覆蓋
- **配置**: 在 `.env` 文件中添加 `FINNHUB_API_KEY=your_key_here`

### 3. Polygon.io
- **網站**: https://polygon.io/
- **免費方案**: 5 請求/分鐘
- **付費方案**: 從 $99/月 開始
- **優勢**: 專業級數據，低延遲
- **配置**: 在 `.env` 文件中添加 `POLYGON_API_KEY=your_key_here`

### 4. Alpha Vantage
- **網站**: https://www.alphavantage.co/
- **免費方案**: 25 請求/天
- **付費方案**: 從 $49.99/月 開始
- **優勢**: 免費額度較大
- **配置**: 在 `.env` 文件中添加 `ALPHA_VANTAGE_KEY=your_key_here`

## ⚙️ 環境變量配置

創建或編輯 `.env` 文件：

```bash
# 數據源 API 密鑰
FMP_API_KEY=your_fmp_api_key_here
FINNHUB_API_KEY=your_finnhub_api_key_here
POLYGON_API_KEY=your_polygon_api_key_here
ALPHA_VANTAGE_KEY=your_alpha_vantage_key_here

# 其他配置...
PERPLEXITY_API_KEY=your_perplexity_api_key
AUTH_USER=admin
AUTH_PASS=your_password
```

## 🔍 檢查數據源狀態

系統會自動檢查可用的數據源並按優先順序使用：

1. 訪問 `/api/backtest/sources` 端點查看數據源狀態
2. 在瀏覽器控制台查看數據源連接日誌
3. 回測開始時會顯示使用的數據源

## 📊 數據源比較

| 數據源 | 免費額度 | 數據品質 | 響應速度 | 歷史數據 | 全球覆蓋 |
|--------|----------|----------|----------|----------|----------|
| FMP | 250/天 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Finnhub | 60/分鐘 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Polygon.io | 5/分鐘 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Alpha Vantage | 25/天 | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |

## 🛠️ 故障排除

### 常見問題

1. **所有數據源都失敗**
   - 檢查 API 密鑰是否正確配置
   - 確認網絡連接正常
   - 檢查 API 密鑰是否過期或額度用完

2. **數據不足**
   - 某些股票可能在某些數據源中不可用
   - 嘗試不同的股票代號格式（如 AAPL vs AAPL.US）
   - 檢查股票是否在數據源支持的交易所上市

3. **響應緩慢**
   - 系統會自動選擇最快的可用數據源
   - 考慮升級到付費方案獲得更好的性能

### 調試工具

- 訪問 `/api/debug/env` 查看 API 密鑰配置狀態
- 訪問 `/api/backtest/sources` 測試數據源連接
- 查看服務器日誌了解詳細錯誤信息

## 💡 使用建議

1. **至少配置一個付費數據源**：免費額度通常不夠進行大量回測
2. **FMP 是最佳選擇**：性價比高，數據品質優秀
3. **備用數據源**：配置多個數據源確保可用性
4. **監控使用量**：避免超出 API 額度限制

## 🔄 數據源切換

系統會自動按以下順序嘗試數據源：
1. FMP → 2. Finnhub → 3. Polygon.io → 4. Alpha Vantage

如果第一個數據源失敗，會自動切換到下一個可用的數據源。

---

配置完成後，重啟服務器並開始使用增強的回測功能！
