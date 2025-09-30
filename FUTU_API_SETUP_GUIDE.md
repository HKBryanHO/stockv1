# 富途 OpenAPI 設置指南

## 🚀 第三階段：富途 OpenAPI 自動交易整合

本指南將幫助您設置富途 OpenAPI，實現真正的自動交易功能。

## 📋 **富途 OpenAPI 優勢**

根據 [富途 OpenAPI 文檔](https://openapi.futunn.com/futu-api-doc/intro/intro.html)：

- **多市場支持**：港股、美股、A股、新加坡、日本市場
- **極速交易**：下單最快只需 0.0014 秒
- **免費使用**：通過 OpenAPI 交易無附加收費
- **多語言支持**：Python、Java、C#、C++、JavaScript
- **實時行情**：支持實時報價、K線、逐筆數據

## 🔧 **第一步：安裝 OpenD 網關程序**

### Windows 用戶

1. **下載 OpenD**
   - 訪問 [富途 OpenAPI 下載頁面](https://openapi.futunn.com/futu-api-doc/quick-start/open-d.html)
   - 下載 Windows 版本的 OpenD

2. **安裝 OpenD**
   ```bash
   # 解壓下載的文件到任意目錄
   # 例如：C:\OpenD\
   ```

3. **啟動 OpenD**
   ```bash
   # 進入 OpenD 目錄
   cd C:\OpenD\
   
   # 啟動 OpenD
   OpenD.exe
   ```

### macOS 用戶

1. **下載 OpenD**
   ```bash
   # 使用 Homebrew 安裝（推薦）
   brew install futu-api
   
   # 或手動下載
   # 訪問富途官網下載 macOS 版本
   ```

2. **啟動 OpenD**
   ```bash
   # 使用 Homebrew 安裝的版本
   futu-opend
   
   # 或手動啟動
   ./OpenD
   ```

### Linux 用戶

1. **下載 OpenD**
   ```bash
   # Ubuntu/Debian
   wget https://software.futunn.com/download/OpenD/OpenD_linux_x64.tar.gz
   tar -xzf OpenD_linux_x64.tar.gz
   
   # CentOS/RHEL
   wget https://software.futunn.com/download/OpenD/OpenD_linux_x64.tar.gz
   tar -xzf OpenD_linux_x64.tar.gz
   ```

2. **啟動 OpenD**
   ```bash
   # 進入解壓目錄
   cd OpenD_linux_x64/
   
   # 啟動 OpenD
   ./OpenD
   ```

## 🔑 **第二步：獲取富途賬號**

### 註冊富途賬號

1. **下載富途牛牛 APP**
   - iOS：App Store 搜索「富途牛牛」
   - Android：Google Play 或應用商店搜索「富途牛牛」

2. **註冊賬號**
   - 使用手機號或郵箱註冊
   - 完成身份驗證
   - 開通證券賬戶

3. **獲取 API 權限**
   - 在富途牛牛 APP 中
   - 進入「我的」→「設置」→「OpenAPI」
   - 開啟 OpenAPI 權限
   - 記錄您的賬號和密碼

## 🐍 **第三步：Python 環境設置**

### 安裝富途 Python SDK

```bash
# 安裝富途 API
pip install futu-api

# 驗證安裝
python -c "import futu; print('富途 API 安裝成功')"
```

### 測試連接

```bash
# 使用命令行工具測試
python futu_cli.py connect your_username your_password

# 獲取行情測試
python futu_cli.py quote HK.00700

# 查詢持倉測試
python futu_cli.py positions --env SIMULATE
```

## 🌐 **第四步：Web 界面設置**

### 啟動服務器

```bash
# 啟動 Node.js 服務器
node server.js

# 在另一個終端啟動前端服務器
cd public
python -m http.server 8080
```

### 訪問 Web 界面

1. **打開瀏覽器**
   - 訪問：`http://localhost:8080`
   - 點擊「Pro Chart」標籤

2. **連接富途 API**
   - 在「富途 API 連接」區域
   - 輸入富途賬號和密碼
   - 點擊「連接」按鈕

3. **測試功能**
   - 獲取實時行情
   - 執行模擬交易
   - 查詢持倉和訂單

## 📊 **支持的市場和品種**

### 港股市場
- **股票**：騰訊 (HK.00700)、阿里巴巴 (HK.09988)
- **ETFs**：盈富基金 (HK.02800)
- **窩輪**：認購證、認沽證
- **期權**：指數期權
- **期貨**：恒指期貨

### 美股市場
- **股票**：蘋果 (US.AAPL)、特斯拉 (US.TSLA)
- **ETFs**：SPY、QQQ
- **期權**：股票期權、指數期權
- **期貨**：CME 期貨

### A股市場
- **A股通股票**：平安 (SZ.000001)、茅台 (SH.600519)
- **指數**：上證指數、深證成指

## 🔧 **API 端點說明**

### 連接端點
```
POST /futu/connect
{
    "username": "your_username",
    "password": "your_password",
    "host": "127.0.0.1",
    "port": 11111
}
```

### 行情端點
```
GET /futu/quote/HK.00700
```

### 交易端點
```
POST /futu/order
{
    "symbol": "HK.00700",
    "price": 300.0,
    "quantity": 100,
    "side": "BUY",
    "order_type": "NORMAL",
    "env": "SIMULATE"
}
```

### 持倉端點
```
GET /futu/positions?env=SIMULATE
```

## 🛡️ **風險管理**

### 模擬交易
- **建議先使用模擬交易**
- 熟悉 API 功能和交易流程
- 測試交易策略的有效性

### 實盤交易
- **謹慎使用實盤交易**
- 設置合理的止損點
- 控制倉位大小
- 定期檢查交易記錄

## 🚨 **常見問題**

### Q1: OpenD 無法啟動
**解決方案**：
1. 檢查防火牆設置
2. 確認端口 11111 未被占用
3. 以管理員身份運行 OpenD

### Q2: 連接失敗
**解決方案**：
1. 確認 OpenD 正在運行
2. 檢查賬號密碼是否正確
3. 確認網絡連接正常

### Q3: 下單失敗
**解決方案**：
1. 檢查股票代碼格式
2. 確認交易時間
3. 檢查賬戶餘額

### Q4: 行情數據異常
**解決方案**：
1. 檢查股票代碼是否正確
2. 確認市場是否開市
3. 重新連接 API

## 📈 **交易策略示例**

### 簡單移動平均策略
```python
def ma_strategy(symbol, current_price, quote_data):
    # 計算移動平均
    ma_5 = calculate_ma(quote_data, 5)
    ma_20 = calculate_ma(quote_data, 20)
    
    if ma_5 > ma_20:
        return {"action": "BUY", "quantity": 100, "price": current_price}
    elif ma_5 < ma_20:
        return {"action": "SELL", "quantity": 100, "price": current_price}
    
    return None
```

### RSI 策略
```python
def rsi_strategy(symbol, current_price, quote_data):
    rsi = calculate_rsi(quote_data, 14)
    
    if rsi < 30:  # 超賣
        return {"action": "BUY", "quantity": 100, "price": current_price}
    elif rsi > 70:  # 超買
        return {"action": "SELL", "quantity": 100, "price": current_price}
    
    return None
```

## 🎯 **下一步**

1. **完成設置**：按照本指南完成所有設置
2. **測試功能**：使用模擬交易測試所有功能
3. **開發策略**：根據您的需求開發交易策略
4. **實盤交易**：在充分測試後考慮實盤交易

## 📞 **技術支持**

- **富途官方文檔**：[https://openapi.futunn.com/futu-api-doc/](https://openapi.futunn.com/futu-api-doc/)
- **富途客服**：通過富途牛牛 APP 聯繫客服
- **GitHub Issues**：在項目倉庫提交問題

## ⚠️ **免責聲明**

- 本系統僅供學習和研究使用
- 實盤交易存在風險，請謹慎操作
- 投資有風險，入市需謹慎
- 作者不承擔任何投資損失責任

---

**祝您交易順利！** 🚀
