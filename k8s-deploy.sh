#!/bin/bash

# Kubernetes 部署腳本
set -e

echo "☸️ 開始 Kubernetes 部署..."

# 檢查 kubectl 是否安裝
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl 未安裝，請先安裝 kubectl"
    exit 1
fi

# 檢查集群連接
echo "🔍 檢查集群連接..."
kubectl cluster-info

# 創建命名空間
echo "📁 創建命名空間..."
kubectl apply -f k8s/namespace.yaml

# 創建 ConfigMap
echo "⚙️ 創建 ConfigMap..."
kubectl apply -f k8s/configmap.yaml

# 創建 Secret
echo "🔐 創建 Secret..."
kubectl create secret generic trading-secrets \
  --from-literal=jwt-secret=your-jwt-secret-key \
  --from-literal=db-password=password \
  --namespace=trading-system

# 創建 PVC
echo "💾 創建持久化存儲..."
kubectl apply -f k8s/pvc.yaml

# 部署數據庫
echo "🗄️ 部署數據庫..."
kubectl apply -f k8s/postgres-deployment.yaml

# 部署 Redis
echo "🔴 部署 Redis..."
kubectl apply -f k8s/redis-deployment.yaml

# 等待數據庫就緒
echo "⏳ 等待數據庫就緒..."
kubectl wait --for=condition=ready pod -l app=postgres -n trading-system --timeout=300s

# 部署應用
echo "🚀 部署應用..."
kubectl apply -f k8s/deployment.yaml

# 創建服務
echo "🌐 創建服務..."
kubectl apply -f k8s/service.yaml

# 創建 Ingress
echo "🔗 創建 Ingress..."
kubectl apply -f k8s/ingress.yaml

# 等待應用就緒
echo "⏳ 等待應用就緒..."
kubectl wait --for=condition=ready pod -l app=trading-app -n trading-system --timeout=300s

# 檢查部署狀態
echo "🔍 檢查部署狀態..."
kubectl get pods -n trading-system
kubectl get services -n trading-system
kubectl get ingress -n trading-system

# 顯示訪問信息
echo "✅ Kubernetes 部署完成！"
echo "📊 應用地址: http://trading.yourdomain.com"
echo "🔧 API 地址: http://trading.yourdomain.com/api"

# 顯示日誌
echo "📋 顯示應用日誌..."
kubectl logs -l app=trading-app -n trading-system --tail=50
