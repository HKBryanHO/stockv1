# 部署指南

## 🚀 快速開始

### 本地開發環境

1. **使用啟動腳本 (推薦)**
```bash
# Windows
start.bat

# Linux/Mac
./start.sh
```

2. **手動啟動**
```bash
# 安裝依賴
npm install

# 配置環境變數
cp env.example .env
# 編輯 .env 添加 ALPHA_VANTAGE_KEY

# 啟動優化版本
npm run start:optimized
```

### Docker 部署

```bash
# 使用 Docker Compose (推薦)
docker-compose up -d

# 查看日誌
docker-compose logs -f

# 停止服務
docker-compose down
```

## 🌐 生產環境部署

### 1. 雲端平台部署

#### Heroku
```bash
# 創建應用
heroku create your-app-name

# 添加 Redis
heroku addons:create heroku-redis:mini

# 設置環境變數
heroku config:set ALPHA_VANTAGE_KEY=your_key_here
heroku config:set NODE_ENV=production

# 部署
git push heroku main
```

#### Render
1. 連接 GitHub 倉庫
2. 選擇 "Web Service"
3. 設置環境變數
4. 添加 Redis 服務
5. 部署

#### Railway
```bash
# 安裝 Railway CLI
npm install -g @railway/cli

# 登入
railway login

# 部署
railway up
```

### 2. VPS 部署

#### Ubuntu/Debian
```bash
# 更新系統
sudo apt update && sudo apt upgrade -y

# 安裝 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# 安裝 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 克隆專案
git clone <repository-url>
cd stock-predictor

# 配置環境變數
cp env.example .env
nano .env

# 啟動服務
docker-compose up -d
```

#### CentOS/RHEL
```bash
# 安裝 Docker
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install -y docker-ce docker-ce-cli containerd.io
sudo systemctl start docker
sudo systemctl enable docker

# 安裝 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 其餘步驟同 Ubuntu
```

### 3. 設置 Nginx 反向代理

```nginx
# /etc/nginx/sites-available/stock-predictor
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# 啟用站點
sudo ln -s /etc/nginx/sites-available/stock-predictor /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 4. SSL 證書 (Let's Encrypt)

```bash
# 安裝 Certbot
sudo apt install certbot python3-certbot-nginx

# 獲取證書
sudo certbot --nginx -d your-domain.com

# 自動續期
sudo crontab -e
# 添加: 0 12 * * * /usr/bin/certbot renew --quiet
```

## 🔧 環境變數配置

### 必需變數
```bash
ALPHA_VANTAGE_KEY=your_api_key_here
```

### 可選變數
```bash
PORT=3001
NODE_ENV=production
REDIS_URL=redis://localhost:6379
ALLOWED_ORIGINS=https://yourdomain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 📊 監控和維護

### 健康檢查
```bash
# 檢查應用狀態
curl http://localhost:3001/api/health

# 檢查 Redis 連接
redis-cli ping
```

### 日誌查看
```bash
# Docker 日誌
docker-compose logs -f app

# 系統日誌
journalctl -u your-service-name -f
```

### 性能監控
```bash
# 查看資源使用
docker stats

# 查看 Redis 內存使用
redis-cli info memory
```

## 🚨 故障排除

### 常見問題

1. **API 金鑰錯誤**
   - 檢查 `.env` 文件中的 `ALPHA_VANTAGE_KEY`
   - 確認 API 金鑰有效且有足夠配額

2. **Redis 連接失敗**
   - 檢查 Redis 服務是否運行
   - 確認 `REDIS_URL` 配置正確
   - 檢查防火牆設置

3. **端口衝突**
   - 更改 `PORT` 環境變數
   - 檢查其他服務是否佔用端口

4. **內存不足**
   - 增加服務器內存
   - 優化 Redis 配置
   - 減少蒙特卡洛路徑數

### 日誌分析
```bash
# 查看錯誤日誌
docker-compose logs app | grep ERROR

# 查看 API 調用日誌
docker-compose logs app | grep "alphavantage"
```

## 🔄 更新部署

### 滾動更新
```bash
# 拉取最新代碼
git pull origin main

# 重新構建並部署
docker-compose up -d --build

# 檢查服務狀態
docker-compose ps
```

### 數據備份
```bash
# 備份 Redis 數據
docker exec stock-predictor-redis redis-cli BGSAVE
docker cp stock-predictor-redis:/data/dump.rdb ./backup/

# 恢復數據
docker cp ./backup/dump.rdb stock-predictor-redis:/data/
docker restart stock-predictor-redis
```

## 📈 擴展性考慮

### 水平擴展
- 使用負載均衡器 (Nginx, HAProxy)
- 多實例部署
- Redis 集群

### 垂直擴展
- 增加服務器資源
- 優化 Redis 配置
- 使用更快的存儲

### 緩存策略
- 實施多層緩存
- 使用 CDN 加速靜態資源
- 優化 API 響應時間

## 🔒 安全最佳實踐

1. **環境變數安全**
   - 不要在代碼中硬編碼敏感信息
   - 使用環境變數管理配置
   - 定期輪換 API 金鑰

2. **網絡安全**
   - 設置適當的 CORS 政策
   - 實施速率限制
   - 使用 HTTPS

3. **容器安全**
   - 使用非 root 用戶運行容器
   - 定期更新基礎映像
   - 掃描安全漏洞

4. **監控和告警**
   - 設置健康檢查
   - 監控資源使用
   - 配置告警通知
