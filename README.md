# 股票預測模型 - 專業版

一個基於現代Web技術的股票預測系統，整合了多種量化金融模型和風險管理工具。

## 🚀 主要特性

### 後端優化
- **真正的量化模型**: 實現了 Jump Diffusion、Heston 隨機波動率、GARCH(1,1) 等專業模型
- **Redis 快取**: 持久化快取，支援多實例部署
- **微服務架構**: 模組化設計，易於擴展和維護
- **健康檢查**: 完整的監控和健康檢查機制

### 前端現代化
- **響應式設計**: 支援桌面和移動設備
- **模組化架構**: 分離的 HTML、CSS、JavaScript
- **現代 UI/UX**: 基於設計系統的用戶界面
- **實時更新**: WebSocket 支援實時數據更新

### 量化模型
- **Geometric Brownian Motion (GBM)**: 基準模型
- **Jump Diffusion**: 考慮跳躍風險的模型
- **Heston 隨機波動率**: 波動率聚類效應
- **GARCH(1,1)**: 條件異方差模型

## 📋 系統要求

- Node.js 18+
- Redis 6+
- Docker & Docker Compose (可選)

## 🔌 API 配置指南

### 🚀 快速設置

1. **複製環境配置**：
   ```bash
   cp env.example .env
   ```

2. **運行設置腳本**：
   ```bash
   # Windows
   setup-apis.bat
   
   # Linux/Mac
   ./setup-apis.sh
   ```

3. **測試 API 配置**：
   ```bash
   node test-apis.js
   ```

### 📊 推薦 API 配置

#### 最小配置 (只需2個API)
```bash
# 主要數據源
FINNHUB_API_KEY=你的_finnhub_金鑰
FMP_API_KEY=你的_fmp_金鑰
```

#### 完整配置 (最佳體驗)
```bash
# 1. Finnhub API (推薦 - 最穩定)
FINNHUB_API_KEY=你的_finnhub_金鑰

# 2. Financial Modeling Prep (基本面數據)
FMP_API_KEY=你的_fmp_金鑰

# 3. Polygon.io (美股專業數據)
POLYGON_API_KEY=你的_polygon_金鑰

# 4. Alpha Vantage (備用數據源)
ALPHA_VANTAGE_KEY=你的_alpha_vantage_金鑰
```

### 🔑 API 註冊連結

| API | 免費額度 | 註冊連結 | 推薦度 |
|-----|----------|----------|--------|
| **Finnhub** | 60次/分鐘 | [註冊](https://finnhub.io/register) | ⭐⭐⭐⭐⭐ |
| **FMP** | 250次/天 | [註冊](https://financialmodelingprep.com/developer/docs) | ⭐⭐⭐⭐ |
| **Polygon.io** | 5次/分鐘 | [註冊](https://polygon.io/) | ⭐⭐⭐ |
| **Alpha Vantage** | 5次/分鐘 | [註冊](https://www.alphavantage.co/support/#api-key) | ⭐⭐ |

### 🧪 測試 API 配置

```bash
# 檢查 API 配置狀態
curl "http://localhost:3001/api/debug/env"

# 測試增強版端點
curl "http://localhost:3001/api/quote/enhanced?symbol=AAPL"

# 測試市場預測頁面
curl "http://localhost:3001/api/market/insights?symbols=AAPL,MSFT,GOOGL"
```

### 📖 詳細設置指南

查看 `API_SETUP_GUIDE.md` 獲取完整的API配置說明。

### 🔌 接入 xAI Grok（數據提取與分析，含串流與快取）

#### 環境變數

在 `.env`（或部署平臺環境）設定：

```
XAI_API_KEY=你的_grok_api_key
XAI_API_BASE= # 留空使用預設，例如 https://api.x.ai/v1/chat/completions
XAI_MODEL=grok-2-latest
```

同時保留股票數據 API 與其他原有設定。

### 後端代理端點

伺服器新增了安全代理端點（避免在前端暴露金鑰）：

- `POST /api/grok/chat`
- `POST /api/grok/stream`（SSE 串流，token 即時回傳）
- `POST /api/grok/analyze`（結構化 JSON 分析，10 分鐘快取）

請求 Body（OpenAI 兼容格式）：

```json
{
  "model": "grok-2-latest",
  "messages": [
    { "role": "system", "content": "You are a helpful financial analysis assistant." },
    { "role": "user", "content": "請分析 AAPL 最近三個月走勢與風險點" }
  ],
  "stream": false
}
```

回應格式與 OpenAI Chat Completions 類似，前端已作相容處理。

### 前端使用

在 `index.html` 的結果面板新增了「Grok AI 分析」區塊：可輸入 API 金鑰、選擇模板（分析師/風險/新聞/篩選）、語氣（中性/保守/進取）、並啟用串流；點擊「送出給 Grok」即可串流顯示回覆，按「取消」可中止。

### 本地測試步驟

1. 建立 `.env` 並填入 `XAI_API_KEY`。
2. 啟動後端：
   ```bash
   npm run start:optimized
   # 或
   npm start
   ```
3. 在瀏覽器開啟 `http://localhost:3001/`。
4. 滾動到「Grok AI 分析」，輸入提示詞測試。

若你自定義或企業代理不同，設定 `XAI_API_BASE` 指向你的 Chat Completions 端點即可。

## 🛠️ 安裝與部署

### 本地開發

1. **克隆專案**
```bash
git clone <repository-url>
cd stock-predictor
```

2. **安裝依賴**
```bash
npm install
```

3. **配置環境變數**
```bash
cp env.example .env
# 編輯 .env 文件，添加你的 Alpha Vantage API 金鑰
```

4. **啟動 Redis (可選)**
```bash
# 使用 Docker
docker run -d -p 6379:6379 redis:7-alpine

# 或使用本地安裝
redis-server
```

5. **啟動應用**
```bash
# 使用優化版本
npm run start:optimized

# 或使用原版
npm start
```

6. **訪問應用**
```
http://localhost:3001
```

### Docker 部署

1. **使用 Docker Compose (推薦)**
```bash
# 複製環境變數文件
cp env.example .env
# 編輯 .env 添加 API 金鑰

# 啟動所有服務
docker-compose up -d

# 查看日誌
docker-compose logs -f
```

2. **單獨構建 Docker 映像**
```bash
# 構建映像
docker build -t stock-predictor .

# 運行容器
docker run -d \
  -p 3001:3001 \
  -e ALPHA_VANTAGE_KEY=your_key_here \
  -e REDIS_URL=redis://host.docker.internal:6379 \
  stock-predictor
```

### 生產環境部署

#### 使用 Heroku

1. **創建 Heroku 應用**
```bash
heroku create your-app-name
```

2. **添加 Redis 插件**
```bash
heroku addons:create heroku-redis:mini
```

3. **設置環境變數**
```bash
heroku config:set ALPHA_VANTAGE_KEY=your_key_here
heroku config:set NODE_ENV=production
```

4. **部署**
```bash
git push heroku main
```

#### 使用 Render

1. 連接 GitHub 倉庫
2. 設置環境變數
3. 選擇 Docker 部署方式
4. 添加 Redis 服務

#### 使用 Render（前端靜態 + 後端 Node 代理快速方案）

- 建立 Web Service：指向本倉庫或只包含 `server.js` 的新倉庫。
- 環境變數：
  - `ALPHA_VANTAGE_KEY=你的key`
  - `PORT=3001`
- 取得後端 URL（例如 `https://your-api.onrender.com`）。
- 前端 `index.html` 的 `<meta name="backend-base">` 可留空，前端會自動預設：
  - 本地開發：使用 `window.location.origin`
  - 生產域名：預設使用 `https://your-api.onrender.com`
  - 你也可以填入實際的後端 URL 覆蓋預設。

前端所有 `fetch` 已自動使用 `backendBase` 前綴，且不需要在前端輸入 Alpha Vantage API 金鑰。

#### 使用 VPS

1. **安裝 Docker 和 Docker Compose**
```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
sudo usermod -aG docker $USER

# 安裝 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

2. **部署應用**
```bash
# 克隆專案
git clone <repository-url>
cd stock-predictor

# 配置環境變數
cp env.example .env
nano .env

# 啟動服務
docker-compose up -d
```

3. **設置 Nginx 反向代理 (可選)**
```bash
# 安裝 Nginx
sudo apt update
sudo apt install nginx

# 配置 Nginx
sudo nano /etc/nginx/sites-available/stock-predictor
```

## 🔧 配置說明

### 環境變數

| 變數名 | 描述 | 預設值 |
|--------|------|--------|
| `ALPHA_VANTAGE_KEY` | Alpha Vantage API 金鑰 | 必填 |
| `PORT` | 服務器端口 | 3001 |
| `NODE_ENV` | 環境模式 | development |
| `REDIS_URL` | Redis 連接 URL | redis://localhost:6379 |
| `ALLOWED_ORIGINS` | CORS 允許的來源 | * |

### API 端點

| 端點 | 方法 | 描述 |
|------|------|------|
| `/api/alphavantage` | GET | Alpha Vantage 代理 |
| `/api/sim/jump` | POST | Jump Diffusion 模擬 |
| `/api/sim/heston` | POST | Heston 模型模擬 |
| `/api/sim/garch` | POST | GARCH 模型模擬 |
| `/api/monitor/status` | GET | 監控狀態 |
| `/api/health` | GET | 健康檢查 |

## 📊 使用指南

### 基本預測流程

1. **選擇市場和股票代號**
   - 香港市場: 使用 `.HK` 後綴 (如 `0700.HK`)
   - 美國市場: 直接使用代號 (如 `AAPL`)

2. **設置參數**
   - 投資金額: 用於風險計算
   - 預測時長: 1週到1年
   - 蒙特卡洛路徑數: 500-20000
   - 風險容忍度: 1-30%

3. **選擇模型**
   - GBM: 基準幾何布朗運動
   - Jump Diffusion: 考慮跳躍風險
   - Heston: 隨機波動率模型
   - GARCH: 條件異方差模型

4. **分析結果**
   - 查看核心 KPI
   - 分析風險指標
   - 檢查技術指標
   - 評估基本面

### 風險管理建議

1. **倉位管理**
   - 單一標的不超過總資產的 20%
   - 基於 VaR 95% 計算建議倉位
   - 設置止損和止盈點

2. **分散投資**
   - 跨市場分散
   - 跨行業分散
   - 定期再平衡

3. **監控指標**
   - 最大回撤 (MDD)
   - 夏普比率
   - VaR 和 ES

## 🔍 技術架構

### 後端架構
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Nginx         │    │   Node.js       │
│   (React/Vue)   │◄──►│   (Reverse      │◄──►│   (Express)     │
│                 │    │    Proxy)       │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                       ┌─────────────────┐              │
                       │   Redis         │◄─────────────┘
                       │   (Cache)       │
                       └─────────────────┘
```

### 數據流程
```
Alpha Vantage API → Redis Cache → Node.js Server → Frontend
                                      │
                              Quantitative Models
                                      │
                              Risk Calculations
```

## 🚨 注意事項

### 安全考慮
- 生產環境請移除前端 API 金鑰
- 使用環境變數管理敏感信息
- 設置適當的 CORS 政策
- 實施速率限制

### 性能優化
- 使用 Redis 快取減少 API 調用
- 實施請求合併避免重複調用
- 使用 CDN 加速靜態資源
- 監控內存使用和響應時間

### 法律免責
- 本工具僅供學術研究和教育目的
- 不構成投資建議
- 使用者需自行承擔投資風險
- 建議諮詢專業財務顧問

## 🤝 貢獻指南

1. Fork 專案
2. 創建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 開啟 Pull Request

## 📄 許可證

本專案採用 MIT 許可證 - 查看 [LICENSE](LICENSE) 文件了解詳情。

## 📞 支援

如有問題或建議，請：
- 開啟 [Issue](https://github.com/your-repo/issues)
- 發送郵件至 support@example.com
- 查看 [Wiki](https://github.com/your-repo/wiki) 獲取更多文檔

## 🔄 更新日誌

### v2.0.0 (2024-01-XX)
- ✨ 實現真正的量化模型計算
- 🚀 引入 Redis 快取系統
- 🎨 完全重構前端界面
- 📱 響應式設計支援
- 🐳 Docker 容器化部署
- 📊 增強監控和健康檢查

### v1.0.0 (2023-XX-XX)
- 🎉 初始版本發布
- 📈 基本股票預測功能
- 📊 簡單圖表顯示
- 💾 本地存儲歷史記錄
