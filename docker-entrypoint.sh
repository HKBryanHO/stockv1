#!/bin/bash

# 安裝 Node.js 依賴
echo "安裝 Node.js 依賴..."
npm install

# 運行數據庫遷移（如果存在）
if [ -f "migrate.js" ]; then
    echo "運行數據庫遷移..."
    node migrate.js
fi

# 啟動 Node.js 服務器
echo "啟動 Node.js 服務器..."
echo "🔐 密碼修改功能已啟用 - Docker 版本: $(date)"
node server.js
