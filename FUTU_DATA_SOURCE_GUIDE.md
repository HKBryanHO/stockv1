# 富途 API 數據源配置指南

## 🎯 概述

本系統已完全配置為使用富途 API 作為主要數據源，提供更準確、實時的港股、美股、A股數據。

## 📊 數據源優勢

### 富途 API 優勢
- **實時性強**：毫秒級數據更新
- **數據準確**：直接來自交易所
- **覆蓋全面**：港股、美股、A股、期貨等
- **免費使用**：無需付費 API 密鑰
- **中文支持**：完整的中文股票名稱和描述

### 支持的市場
- **港股**：HK.00700 (騰訊)、HK.09988 (阿里巴巴) 等
- **美股**：US.AAPL (蘋果)、US.TSLA (特斯拉) 等
- **A股**：SH.000001 (上證指數)、SZ.000001 (平安銀行) 等

## 🔧 配置步驟

### 1. 安裝富途 OpenD

```bash
# 下載富途 OpenD
# 訪問：https://www.futunn.com/download/openAPI
# 下載並安裝 OpenD 客戶端

# 啟動 OpenD
# 默認端口：11111
# 默認地址：127.0.0.1
```

### 2. 配置環境變量

```bash
# 在 .env 文件中添加
FUTU_USERNAME=your_futu_username
FUTU_PASSWORD=your_futu_password
FUTU_HOST=127.0.0.1
FUTU_PORT=11111
```

### 3. 測試連接

```bash
# 測試富途 API 連接
python futu_cli.py connect your_username your_password

# 測試獲取實時行情
python futu_cli.py quote HK.00700

# 測試獲取歷史數據
python futu_cli.py historical HK.00700 2023-01-01 2024-01-01
```

## 📈 數據格式

### 歷史數據格式
```json
{
  "success": true,
  "data": [
    {
      "date": "2024-01-01",
      "open": 100.0,
      "high": 105.0,
      "low": 98.0,
      "close": 103.0,
      "volume": 1000000,
      "turnover": 103000000
    }
  ],
  "source": "Futu API"
}
```

### 實時行情格式
```json
{
  "success": true,
  "data": {
    "symbol": "HK.00700",
    "price": 103.0,
    "open": 100.0,
    "high": 105.0,
    "low": 98.0,
    "previousClose": 102.0,
    "change": 1.0,
    "changePercent": 0.98,
    "volume": 1000000,
    "turnover": 103000000,
    "timestamp": "2024-01-01T10:30:00.000Z"
  },
  "source": "Futu API"
}
```

## 🚀 使用方式

### 1. 前端使用

```javascript
// 獲取歷史數據
const response = await fetch('/historical-data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    symbol: 'HK.00700',
    days: 365
  })
});

// 獲取實時行情
const response = await fetch('/realtime/HK.00700');
```

### 2. 後端使用

```javascript
// 使用富途數據源
const FutuDataSource = require('./futu_data_source');
const dataSource = new FutuDataSource();

// 連接富途 API
await dataSource.connect(username, password);

// 獲取歷史數據
const historicalData = await dataSource.getHistoricalData('HK.00700', '2023-01-01', '2024-01-01');

// 獲取實時行情
const realtimeData = await dataSource.getRealtimeQuote('HK.00700');
```

### 3. Python 使用

```python
from futu_api_integration import FutuAPIManager

# 創建管理器
manager = FutuAPIManager()

# 連接富途 API
result = manager.connect('username', 'password')

# 獲取歷史數據
historical = manager.get_historical_data('HK.00700', '2023-01-01', '2024-01-01')

# 獲取實時行情
quote = manager.get_realtime_quote(['HK.00700'])
```

## 🔄 數據流程

### 1. 歷史數據流程
```
前端請求 → 後端 API → 富途 Python 腳本 → 富途 OpenD → 返回數據
```

### 2. 實時數據流程
```
前端請求 → 後端 API → 富途 Python 腳本 → 富途 OpenD → 返回實時行情
```

### 3. 交易數據流程
```
前端請求 → 後端 API → 富途 Python 腳本 → 富途 OpenD → 執行交易
```

## 📊 支持的股票代碼格式

### 港股格式
- **騰訊**：HK.00700
- **阿里巴巴**：HK.09988
- **美團**：HK.03690

### 美股格式
- **蘋果**：US.AAPL
- **特斯拉**：US.TSLA
- **微軟**：US.MSFT

### A股格式
- **平安銀行**：SZ.000001
- **招商銀行**：SH.600036
- **貴州茅台**：SH.600519

## ⚠️ 注意事項

### 1. 連接要求
- 需要安裝富途 OpenD 客戶端
- 需要富途賬戶和密碼
- OpenD 必須在運行狀態

### 2. 數據限制
- 免費賬戶有數據頻率限制
- 實時數據需要訂閱
- 歷史數據有時間範圍限制

### 3. 錯誤處理
- 如果富途 API 不可用，系統會自動回退到模擬數據
- 所有 API 調用都有超時和重試機制
- 錯誤信息會在前端顯示

## 🔧 故障排除

### 1. 連接失敗
```bash
# 檢查 OpenD 是否運行
netstat -an | grep 11111

# 檢查防火牆設置
# 確保 11111 端口開放
```

### 2. 數據獲取失敗
```bash
# 檢查 Python 環境
python -c "import futu; print('Futu API installed')"

# 檢查網絡連接
ping 127.0.0.1
```

### 3. 權限問題
```bash
# 檢查文件權限
chmod +x futu_api_integration.py

# 檢查 Python 路徑
which python
```

## 📈 性能優化

### 1. 數據緩存
- 實時數據緩存 5 秒
- 歷史數據緩存 1 小時
- 自動清理過期緩存

### 2. 並發控制
- 限制同時連接數
- 請求隊列管理
- 超時處理

### 3. 錯誤恢復
- 自動重連機制
- 降級策略
- 監控告警

## 🎯 最佳實踐

### 1. 數據使用
- 優先使用富途 API 數據
- 設置合理的緩存時間
- 監控數據質量

### 2. 錯誤處理
- 實現降級策略
- 記錄錯誤日誌
- 用戶友好提示

### 3. 性能監控
- 監控 API 響應時間
- 追蹤錯誤率
- 優化數據流程

## 📞 支持

如果您在使用富途 API 數據源時遇到問題：

1. 檢查富途 OpenD 是否正常運行
2. 確認賬戶和密碼正確
3. 查看系統日誌文件
4. 參考富途 API 官方文檔

---

**恭喜！您的交易系統現在完全使用富途 API 作為數據源！** 🎉

這將為您提供：
- ✅ 更準確的實時數據
- ✅ 更豐富的市場覆蓋
- ✅ 更穩定的數據服務
- ✅ 更好的中文支持
