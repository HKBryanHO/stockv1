# Bryanho 管理員設置指南

## 🎯 目標
為股票預測模型創建 Bryanho 管理員帳戶，並設置管理頁面訪問權限。

## 📋 設置方法

### 方法 1: 使用 Web 界面 (推薦)
1. 確保您的服務器正在運行
2. 訪問: `http://your-domain.com/setup-bryanho-admin.html`
3. 填寫表單創建 Bryanho 管理員帳戶
4. 使用創建的憑證登入系統

### 方法 2: 使用命令行腳本
在您的 Render 部署中運行：
```bash
node render-setup-bryanho.js
```

### 方法 3: 使用 API 端點
發送 POST 請求到 `/api/setup/admin`：
```json
{
  "username": "Bryanho",
  "email": "bryanho@stockpredictor.com", 
  "password": "Bryanho123",
  "fullName": "Bryan Ho"
}
```

## 🔑 登入資訊
- **用戶名**: Bryanho
- **密碼**: Bryanho123
- **角色**: 管理員
- **API配額**: 10000

## 🌐 訪問頁面
- **登入頁面**: `/login.html`
- **管理頁面**: `/admin.html`
- **預測頁面**: `/index.html`
- **設置頁面**: `/setup-bryanho-admin.html`

## ⚠️ 安全提醒
1. 首次登入後請立即修改密碼
2. 不要在生產環境中使用默認密碼
3. 定期檢查用戶權限和活動

## 🛠️ 故障排除
如果遇到問題：
1. 檢查數據庫連接
2. 確認 UserManager 已正確初始化
3. 檢查服務器日誌
4. 驗證 API 端點是否可訪問

## 📞 支持
如有問題，請檢查：
- 服務器日誌
- 數據庫狀態
- 網絡連接
- API 端點響應
