# 系統架構說明

## 🏗️ 整體架構

### 系統組件圖
```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend Layer                           │
├─────────────────────────────────────────────────────────────────┤
│  HTML5 + CSS3 + Modern JavaScript (ES6+)                       │
│  ├── Responsive UI Components                                  │
│  ├── Chart.js for Data Visualization                           │
│  ├── TensorFlow.js for LSTM Models                             │
│  └── Local Storage for History                                 │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Reverse Proxy Layer                        │
├─────────────────────────────────────────────────────────────────┤
│  Nginx (Optional)                                              │
│  ├── Static File Serving                                       │
│  ├── Load Balancing                                            │
│  ├── SSL Termination                                           │
│  └── Rate Limiting                                             │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Application Layer                          │
├─────────────────────────────────────────────────────────────────┤
│  Node.js + Express.js                                          │
│  ├── API Gateway                                               │
│  ├── Request Routing                                           │
│  ├── Middleware Stack                                          │
│  └── Error Handling                                            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Business Logic Layer                       │
├─────────────────────────────────────────────────────────────────┤
│  Quantitative Models                                           │
│  ├── Geometric Brownian Motion (GBM)                           │
│  ├── Jump Diffusion Model                                      │
│  ├── Heston Stochastic Volatility                              │
│  ├── GARCH(1,1) Model                                          │
│  └── Risk Management Algorithms                                │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Data Layer                                 │
├─────────────────────────────────────────────────────────────────┤
│  Redis Cache                    │  Alpha Vantage API            │
│  ├── Session Storage            │  ├── Time Series Data         │
│  ├── API Response Cache         │  ├── Fundamental Data         │
│  ├── Rate Limit Tracking        │  └── Real-time Quotes         │
│  └── Monitoring Data            │                               │
└─────────────────────────────────────────────────────────────────┘
```

## 🔄 數據流程

### 1. 用戶請求流程
```
User Input → Frontend Validation → API Request → Backend Processing → Response
```

### 2. 預測計算流程
```
Historical Data → Parameter Estimation → Model Simulation → Risk Analysis → Results
```

### 3. 緩存策略
```
API Request → Cache Check → Cache Hit/Miss → External API (if miss) → Cache Update → Response
```

## 📊 量化模型詳解

### 1. Geometric Brownian Motion (GBM)
```javascript
dS = μSdt + σSdW
```
- **用途**: 基準模型，簡單的股價隨機過程
- **參數**: μ (漂移率), σ (波動率)
- **適用**: 一般市場條件下的股價預測

### 2. Jump Diffusion Model
```javascript
dS = μSdt + σSdW + SdJ
```
- **用途**: 考慮跳躍風險的模型
- **參數**: λ (跳躍頻率), μ_j (跳躍均值), σ_j (跳躍波動率)
- **適用**: 高波動市場，重大事件影響

### 3. Heston Stochastic Volatility
```javascript
dS = μSdt + √V SdW₁
dV = κ(θ - V)dt + σ_v√V dW₂
```
- **用途**: 隨機波動率模型
- **參數**: κ (均值回歸速度), θ (長期波動率), σ_v (波動率的波動率), ρ (相關性)
- **適用**: 波動率聚類效應明顯的市場

### 4. GARCH(1,1) Model
```javascript
σ²ₜ = ω + αε²ₜ₋₁ + βσ²ₜ₋₁
```
- **用途**: 條件異方差模型
- **參數**: ω (基礎方差), α (ARCH係數), β (GARCH係數)
- **適用**: 波動率時變性強的市場

## 🛡️ 風險管理系統

### 風險指標計算
1. **VaR (Value at Risk)**
   - 95% 置信水平下的最大預期損失
   - 用於倉位大小計算

2. **ES (Expected Shortfall)**
   - 超過 VaR 的條件期望損失
   - 尾部風險評估

3. **最大回撤 (Maximum Drawdown)**
   - 歷史最大損失幅度
   - 風險承受能力評估

4. **夏普比率 (Sharpe Ratio)**
   - 風險調整後收益
   - 投資效率評估

### 倉位管理算法
```javascript
suggestedAllocation = min(max(riskBudget / |VaR|, 0), maxAllocation)
```

## 🔧 技術棧詳解

### 後端技術
- **Node.js**: 異步 I/O，高並發處理
- **Express.js**: Web 框架，路由和中介軟體
- **Redis**: 內存數據庫，高速緩存
- **Math.js**: 數學計算庫
- **Node-cron**: 定時任務調度

### 前端技術
- **Vanilla JavaScript**: 原生 JS，無框架依賴
- **CSS Grid/Flexbox**: 響應式布局
- **Chart.js**: 數據可視化
- **TensorFlow.js**: 機器學習模型
- **HTML2Canvas**: 報告生成

### 部署技術
- **Docker**: 容器化部署
- **Docker Compose**: 多服務編排
- **Nginx**: 反向代理和負載均衡
- **Let's Encrypt**: SSL 證書管理

## 📈 性能優化策略

### 1. 緩存策略
- **多層緩存**: 內存 → Redis → 外部 API
- **TTL 策略**: 不同數據類型不同過期時間
- **預取策略**: 熱點數據提前加載

### 2. 計算優化
- **並行計算**: 多路徑模擬並行執行
- **算法優化**: 高效的隨機數生成
- **內存管理**: 及時釋放大對象

### 3. 網絡優化
- **請求合併**: 避免重複 API 調用
- **連接池**: 復用 HTTP 連接
- **壓縮**: Gzip 響應壓縮

## 🔒 安全架構

### 1. 數據安全
- **API 金鑰保護**: 後端代理，前端不暴露
- **輸入驗證**: 參數校驗和清理
- **錯誤處理**: 不洩露敏感信息

### 2. 網絡安全
- **CORS 配置**: 限制跨域請求
- **速率限制**: 防止 API 濫用
- **HTTPS**: 加密傳輸

### 3. 容器安全
- **非 root 用戶**: 降低權限
- **最小化映像**: 減少攻擊面
- **安全掃描**: 定期漏洞檢查

## 📊 監控和可觀測性

### 1. 健康檢查
- **應用健康**: `/api/health` 端點
- **依賴檢查**: Redis 連接狀態
- **資源監控**: CPU、內存使用率

### 2. 日誌系統
- **結構化日誌**: JSON 格式
- **日誌級別**: Error、Warn、Info、Debug
- **日誌聚合**: 集中收集和分析

### 3. 指標收集
- **業務指標**: API 調用次數、響應時間
- **技術指標**: 錯誤率、吞吐量
- **用戶指標**: 活躍用戶、使用模式

## 🚀 擴展性設計

### 1. 水平擴展
- **無狀態設計**: 支持多實例部署
- **負載均衡**: 請求分發
- **數據分片**: Redis 集群

### 2. 垂直擴展
- **資源優化**: CPU、內存調優
- **算法優化**: 計算效率提升
- **緩存優化**: 命中率提升

### 3. 微服務化
- **服務拆分**: 按功能模組分離
- **API 網關**: 統一入口
- **服務發現**: 動態服務註冊

## 🔄 持續集成/持續部署 (CI/CD)

### 1. 代碼管理
- **版本控制**: Git 分支策略
- **代碼審查**: Pull Request 流程
- **自動化測試**: 單元測試和集成測試

### 2. 部署流程
- **自動化構建**: Docker 映像構建
- **環境管理**: 開發、測試、生產環境
- **滾動更新**: 零停機部署

### 3. 監控告警
- **部署監控**: 部署狀態跟蹤
- **性能監控**: 關鍵指標監控
- **告警通知**: 異常情況通知

## 📚 開發指南

### 1. 代碼結構
```
├── server.js                 # 原始服務器
├── server-optimized.js       # 優化服務器
├── public/                   # 前端文件
│   ├── index.html           # 主頁面
│   ├── styles.css           # 樣式文件
│   └── js/
│       └── app.js           # 應用邏輯
├── docker-compose.yml       # Docker 編排
├── Dockerfile              # Docker 構建
└── nginx.conf              # Nginx 配置
```

### 2. 開發流程
1. **功能開發**: 創建功能分支
2. **本地測試**: 運行測試套件
3. **代碼審查**: 提交 Pull Request
4. **自動化測試**: CI/CD 流水線
5. **部署發布**: 自動部署到環境

### 3. 最佳實踐
- **代碼規範**: ESLint + Prettier
- **提交規範**: Conventional Commits
- **文檔更新**: 同步更新文檔
- **版本管理**: Semantic Versioning
