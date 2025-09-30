# 多階段構建 Dockerfile
FROM node:18-alpine AS frontend-builder

# 設置工作目錄
WORKDIR /app

# 複製前端文件
COPY public/ ./public/

# 前端構建（如果需要）
# RUN npm install && npm run build

# Python 運行環境
FROM python:3.11-slim

# 設置工作目錄
WORKDIR /app

# 安裝系統依賴
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    make \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 複製 requirements 文件
COPY requirements.txt .

# 安裝 Python 依賴
RUN pip install --no-cache-dir -r requirements.txt

# 複製應用文件
COPY . .

# 創建非 root 用戶
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# 暴露端口
EXPOSE 3001 8080

# 健康檢查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# 啟動腳本
COPY docker-entrypoint.sh .
RUN chmod +x docker-entrypoint.sh

# 啟動命令
CMD ["./docker-entrypoint.sh"]