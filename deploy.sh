#!/bin/bash

# 交易系統部署腳本
set -e

echo "🚀 開始部署交易系統..."

# 檢查 Docker 是否安裝
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安裝，請先安裝 Docker"
    exit 1
fi

# 檢查 Docker Compose 是否安裝
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose 未安裝，請先安裝 Docker Compose"
    exit 1
fi

# 設置環境變量
export NODE_ENV=production
export PORT=3001

# 創建必要的目錄
echo "📁 創建必要的目錄..."
mkdir -p data logs ssl monitoring/rules

# 設置權限
echo "🔐 設置權限..."
chmod +x docker-entrypoint.sh
chmod 600 ssl/*.key 2>/dev/null || true

# 構建 Docker 鏡像
echo "🐳 構建 Docker 鏡像..."
docker-compose build --no-cache

# 停止現有服務
echo "🛑 停止現有服務..."
docker-compose down

# 啟動服務
echo "🚀 啟動服務..."
docker-compose up -d

# 等待服務啟動
echo "⏳ 等待服務啟動..."
sleep 30

# 檢查服務狀態
echo "🔍 檢查服務狀態..."
docker-compose ps

# 運行健康檢查
echo "🏥 運行健康檢查..."
curl -f http://localhost:3001/health || echo "❌ 健康檢查失敗"

# 顯示訪問信息
echo "✅ 部署完成！"
echo "📊 應用地址: http://localhost:8080"
echo "🔧 API 地址: http://localhost:3001"
echo "📈 Grafana: http://localhost:3000 (admin/admin)"
echo "📊 Prometheus: http://localhost:9090"

# 顯示日誌
echo "📋 顯示服務日誌..."
docker-compose logs --tail=50
