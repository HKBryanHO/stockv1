# 純前端解決方案

## 問題
由於 Node.js 未安裝，後端服務器無法啟動，導致 "Failed to fetch" 錯誤。

## 臨時解決方案
創建一個純前端的版本，使用模擬數據進行演示。

### 優點
- 無需安裝 Node.js
- 可以直接在瀏覽器中運行
- 展示 UI 設計效果

### 限制
- 無法獲取真實股票數據
- 無法使用高級量化模型
- 只能使用模擬數據

## 實施步驟

### 1. 修改 JavaScript 文件
將所有 API 調用替換為模擬數據生成器。

### 2. 創建模擬數據
```javascript
// 模擬股票數據生成器
class MockDataGenerator {
    generateStockData(symbol) {
        // 生成模擬的股票價格數據
        return {
            symbol: symbol,
            closes: this.generatePriceSeries(),
            dates: this.generateDateSeries(),
            volume: this.generateVolumeSeries()
        };
    }
    
    generatePriceSeries() {
        // 生成 252 天的價格數據（一年交易日）
        const prices = [];
        let price = 100; // 起始價格
        
        for (let i = 0; i < 252; i++) {
            // 隨機波動
            const change = (Math.random() - 0.5) * 0.05;
            price = price * (1 + change);
            prices.push(price);
        }
        
        return prices;
    }
}
```

### 3. 更新 API 調用
```javascript
// 替換真實 API 調用
async fetchStockData(symbol, apiKey) {
    // 模擬網絡延遲
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 返回模擬數據
    return this.mockGenerator.generateStockData(symbol);
}
```

## 完整實施
如果您需要這個純前端版本，我可以立即為您創建。
