# 雲端部署和多用戶支持指南

## 🚀 第五階段：雲端部署和多用戶支持

本指南將幫助您部署一個企業級的雲端交易系統，支持多用戶、容器化部署、監控和自動擴展。

## 📋 目錄

1. [系統架構](#系統架構)
2. [Docker 部署](#docker-部署)
3. [Kubernetes 部署](#kubernetes-部署)
4. [多用戶功能](#多用戶功能)
5. [監控和日誌](#監控和日誌)
6. [安全配置](#安全配置)
7. [故障排除](#故障排除)

## 🏗️ 系統架構

### 組件架構
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Database      │
│   (React/Vue)   │◄──►│   (Node.js)     │◄──►│   (PostgreSQL)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Nginx         │    │   Redis         │    │   Monitoring    │
│   (Load Balancer)│   │   (Cache)       │    │   (Prometheus)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 技術棧
- **前端**: HTML5, CSS3, JavaScript (ES6+)
- **後端**: Node.js, Express.js
- **數據庫**: PostgreSQL, Redis
- **容器化**: Docker, Docker Compose
- **編排**: Kubernetes
- **監控**: Prometheus, Grafana
- **反向代理**: Nginx

## 🐳 Docker 部署

### 1. 環境準備

```bash
# 安裝 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# 安裝 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. 配置環境變量

創建 `.env` 文件：
```bash
# 數據庫配置
POSTGRES_DB=trading_db
POSTGRES_USER=trading_user
POSTGRES_PASSWORD=your_secure_password

# Redis 配置
REDIS_PASSWORD=your_redis_password

# JWT 配置
JWT_SECRET=your_jwt_secret_key

# API 密鑰
ALPHA_VANTAGE_KEY=your_alpha_vantage_key
FINNHUB_API_KEY=your_finnhub_key
FMP_API_KEY=your_fmp_key
POLYGON_API_KEY=your_polygon_key
```

### 3. 部署服務

```bash
# 克隆項目
git clone <your-repo-url>
cd stockv1

# 設置權限
chmod +x docker-entrypoint.sh
chmod +x deploy.sh

# 部署服務
./deploy.sh
```

### 4. 驗證部署

```bash
# 檢查服務狀態
docker-compose ps

# 查看日誌
docker-compose logs -f trading-app

# 健康檢查
curl http://localhost:3001/health
```

## ☸️ Kubernetes 部署

### 1. 環境準備

```bash
# 安裝 kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# 安裝 Helm (可選)
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

### 2. 配置集群

```bash
# 創建命名空間
kubectl apply -f k8s/namespace.yaml

# 創建 ConfigMap
kubectl apply -f k8s/configmap.yaml

# 創建 Secret
kubectl create secret generic trading-secrets \
  --from-literal=jwt-secret=your-jwt-secret \
  --from-literal=db-password=your-db-password \
  --namespace=trading-system
```

### 3. 部署應用

```bash
# 部署數據庫
kubectl apply -f k8s/postgres-deployment.yaml

# 部署 Redis
kubectl apply -f k8s/redis-deployment.yaml

# 部署應用
kubectl apply -f k8s/deployment.yaml

# 創建服務
kubectl apply -f k8s/service.yaml

# 創建 Ingress
kubectl apply -f k8s/ingress.yaml
```

### 4. 驗證部署

```bash
# 檢查 Pod 狀態
kubectl get pods -n trading-system

# 檢查服務
kubectl get services -n trading-system

# 檢查 Ingress
kubectl get ingress -n trading-system

# 查看日誌
kubectl logs -l app=trading-app -n trading-system
```

## 👥 多用戶功能

### 用戶角色

#### 1. 管理員 (Admin)
- 管理所有用戶
- 查看系統統計
- 配置系統設置
- 訪問所有功能

#### 2. 交易員 (Trader)
- 執行交易操作
- 使用機器學習功能
- 訪問高級策略
- 查看個人數據

#### 3. 普通用戶 (User)
- 查看基本功能
- 使用預測模型
- 查看個人數據

### 權限管理

```javascript
// 權限配置
const permissions = {
  admin: {
    canTrade: true,
    canViewAllUsers: true,
    canManageUsers: true,
    canViewReports: true,
    canManageSystem: true,
    canAccessML: true,
    canAccessAdvanced: true
  },
  trader: {
    canTrade: true,
    canViewAllUsers: false,
    canManageUsers: false,
    canViewReports: true,
    canManageSystem: false,
    canAccessML: true,
    canAccessAdvanced: true
  },
  user: {
    canTrade: false,
    canViewAllUsers: false,
    canManageUsers: false,
    canViewReports: false,
    canManageSystem: false,
    canAccessML: false,
    canAccessAdvanced: false
  }
};
```

### API 端點

#### 認證端點
- `POST /api/auth/register` - 用戶註冊
- `POST /api/auth/login` - 用戶登錄
- `GET /api/auth/user` - 獲取用戶信息
- `PUT /api/auth/user` - 更新用戶數據

#### 管理端點
- `GET /api/admin/users` - 獲取用戶列表
- `PUT /api/admin/users/:userId/status` - 更新用戶狀態
- `GET /api/admin/stats` - 獲取系統統計

## 📊 監控和日誌

### Prometheus 監控

```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'trading-app'
    static_configs:
      - targets: ['trading-app:3001']
    metrics_path: '/metrics'
```

### Grafana 儀表板

1. 訪問 Grafana: http://localhost:3000
2. 默認登錄: admin/admin
3. 導入儀表板: `monitoring/grafana-dashboard.json`

### 日誌管理

```bash
# 查看應用日誌
docker-compose logs -f trading-app

# 查看數據庫日誌
docker-compose logs -f postgres

# 查看 Redis 日誌
docker-compose logs -f redis
```

## 🔒 安全配置

### 1. 網絡安全

```nginx
# nginx.conf
server {
    listen 80;
    server_name trading.yourdomain.com;
    
    # 安全頭
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    # SSL 重定向
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name trading.yourdomain.com;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    location / {
        proxy_pass http://trading-app:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 2. 應用安全

```javascript
// 速率限制
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分鐘
  max: 100 // 限制每個 IP 100 次請求
});

app.use(limiter);
```

### 3. 數據安全

```sql
-- 數據庫權限
CREATE USER trading_user WITH PASSWORD 'secure_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO trading_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO trading_user;
```

## 🚨 故障排除

### 常見問題

#### 1. 服務無法啟動

```bash
# 檢查 Docker 狀態
docker-compose ps

# 查看錯誤日誌
docker-compose logs trading-app

# 重啟服務
docker-compose restart trading-app
```

#### 2. 數據庫連接失敗

```bash
# 檢查數據庫狀態
docker-compose exec postgres psql -U trading_user -d trading_db

# 檢查網絡連接
docker-compose exec trading-app ping postgres
```

#### 3. 內存不足

```bash
# 檢查內存使用
docker stats

# 調整內存限制
# 在 docker-compose.yml 中設置
services:
  trading-app:
    deploy:
      resources:
        limits:
          memory: 1G
```

#### 4. 權限問題

```bash
# 檢查文件權限
ls -la docker-entrypoint.sh

# 設置正確權限
chmod +x docker-entrypoint.sh
```

### 性能優化

#### 1. 數據庫優化

```sql
-- 創建索引
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_trades_user_id ON trades(user_id);
```

#### 2. 緩存優化

```javascript
// Redis 緩存配置
const redis = require('redis');
const client = redis.createClient({
  host: 'redis',
  port: 6379,
  password: process.env.REDIS_PASSWORD
});
```

#### 3. 負載均衡

```yaml
# Kubernetes HPA
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: trading-app-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: trading-app
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

## 📈 擴展功能

### 1. 自動擴展

```yaml
# Kubernetes HPA
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: trading-app-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: trading-app
  minReplicas: 2
  maxReplicas: 10
```

### 2. 數據備份

```bash
# 數據庫備份
docker-compose exec postgres pg_dump -U trading_user trading_db > backup.sql

# 恢復數據
docker-compose exec -T postgres psql -U trading_user trading_db < backup.sql
```

### 3. 災難恢復

```bash
# 創建快照
kubectl create -f k8s/backup-cronjob.yaml

# 恢復快照
kubectl apply -f k8s/restore-job.yaml
```

## 🎯 最佳實踐

### 1. 開發環境

- 使用 Docker Compose 進行本地開發
- 配置熱重載和調試模式
- 使用環境變量管理配置

### 2. 生產環境

- 使用 Kubernetes 進行生產部署
- 配置監控和告警
- 實施安全最佳實踐

### 3. 維護

- 定期更新依賴
- 監控系統性能
- 備份重要數據

## 📞 支持

如果您在部署過程中遇到問題，請：

1. 檢查日誌文件
2. 查看監控儀表板
3. 參考故障排除指南
4. 聯繫技術支持

---

**恭喜！您已經成功部署了一個企業級的雲端交易系統！** 🎉

這個系統現在具備了：
- ✅ 多用戶支持和權限管理
- ✅ 容器化部署
- ✅ Kubernetes 編排
- ✅ 監控和日誌
- ✅ 安全配置
- ✅ 自動擴展
- ✅ 災難恢復
