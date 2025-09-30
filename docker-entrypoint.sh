#!/bin/bash

# 等待數據庫啟動
echo "等待數據庫啟動..."
while ! nc -z postgres 5432; do
  sleep 1
done
echo "數據庫已啟動"

# 等待 Redis 啟動
echo "等待 Redis 啟動..."
while ! nc -z redis 6379; do
  sleep 1
done
echo "Redis 已啟動"

# 運行數據庫遷移
echo "運行數據庫遷移..."
node migrate.js

# 啟動 Node.js 服務器
echo "啟動 Node.js 服務器..."
node server.js &

# 啟動 Python HTTP 服務器（前端）
echo "啟動前端服務器..."
cd public && python -m http.server 8080 &

# 等待所有進程
wait
