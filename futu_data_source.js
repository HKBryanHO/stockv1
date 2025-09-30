/**
 * 富途數據源模組
 * 統一使用富途 API 獲取所有股票數據
 */

const { spawn } = require('child_process');

class FutuDataSource {
    constructor() {
        this.isConnected = false;
        this.connectionInfo = null;
    }
    
    /**
     * 連接富途 API
     */
    async connect(username, password, host = '127.0.0.1', port = 11111) {
        return new Promise((resolve, reject) => {
            const python = spawn('python', [
                'futu_api_integration.py', 
                'connect', 
                username, 
                password, 
                host, 
                port.toString()
            ]);
            
            let output = '';
            let error = '';
            
            python.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            python.stderr.on('data', (data) => {
                error += data.toString();
            });
            
            python.on('close', (code) => {
                if (code === 0) {
                    try {
                        const result = JSON.parse(output);
                        if (result.success) {
                            this.isConnected = true;
                            this.connectionInfo = { username, host, port };
                            resolve(result);
                        } else {
                            reject(new Error(result.error || '連接失敗'));
                        }
                    } catch (parseError) {
                        reject(new Error('解析連接結果失敗'));
                    }
                } else {
                    reject(new Error(`連接過程失敗: ${error}`));
                }
            });
        });
    }
    
    /**
     * 獲取歷史數據
     */
    async getHistoricalData(symbol, startDate, endDate) {
        return new Promise((resolve, reject) => {
            const python = spawn('python', [
                'futu_api_integration.py', 
                'historical', 
                symbol,
                startDate,
                endDate
            ]);
            
            let output = '';
            let error = '';
            
            python.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            python.stderr.on('data', (data) => {
                error += data.toString();
            });
            
            python.on('close', (code) => {
                if (code === 0) {
                    try {
                        const result = JSON.parse(output);
                        resolve(result);
                    } catch (parseError) {
                        reject(new Error('解析歷史數據失敗'));
                    }
                } else {
                    reject(new Error(`獲取歷史數據失敗: ${error}`));
                }
            });
        });
    }
    
    /**
     * 獲取實時行情
     */
    async getRealtimeQuote(symbol) {
        return new Promise((resolve, reject) => {
            const python = spawn('python', [
                'futu_api_integration.py', 
                'quote', 
                symbol
            ]);
            
            let output = '';
            let error = '';
            
            python.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            python.stderr.on('data', (data) => {
                error += data.toString();
            });
            
            python.on('close', (code) => {
                if (code === 0) {
                    try {
                        const result = JSON.parse(output);
                        resolve(result);
                    } catch (parseError) {
                        reject(new Error('解析實時行情失敗'));
                    }
                } else {
                    reject(new Error(`獲取實時行情失敗: ${error}`));
                }
            });
        });
    }
    
    /**
     * 獲取股票基本信息
     */
    async getStockBasicInfo(symbols) {
        return new Promise((resolve, reject) => {
            const python = spawn('python', [
                'futu_api_integration.py', 
                'basic_info', 
                JSON.stringify(symbols)
            ]);
            
            let output = '';
            let error = '';
            
            python.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            python.stderr.on('data', (data) => {
                error += data.toString();
            });
            
            python.on('close', (code) => {
                if (code === 0) {
                    try {
                        const result = JSON.parse(output);
                        resolve(result);
                    } catch (parseError) {
                        reject(new Error('解析股票信息失敗'));
                    }
                } else {
                    reject(new Error(`獲取股票信息失敗: ${error}`));
                }
            });
        });
    }
    
    /**
     * 獲取市值信息
     */
    async getMarketCap(symbols) {
        return new Promise((resolve, reject) => {
            const python = spawn('python', [
                'futu_api_integration.py', 
                'market_cap', 
                JSON.stringify(symbols)
            ]);
            
            let output = '';
            let error = '';
            
            python.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            python.stderr.on('data', (data) => {
                error += data.toString();
            });
            
            python.on('close', (code) => {
                if (code === 0) {
                    try {
                        const result = JSON.parse(output);
                        resolve(result);
                    } catch (parseError) {
                        reject(new Error('解析市值信息失敗'));
                    }
                } else {
                    reject(new Error(`獲取市值信息失敗: ${error}`));
                }
            });
        });
    }
    
    /**
     * 轉換富途數據為標準格式
     */
    convertToStandardFormat(futuData, dataType = 'historical') {
        if (dataType === 'historical') {
            return futuData.map(item => ({
                date: item.date,
                open: parseFloat(item.open),
                high: parseFloat(item.high),
                low: parseFloat(item.low),
                close: parseFloat(item.close),
                volume: parseInt(item.volume),
                turnover: parseFloat(item.turnover || 0)
            }));
        } else if (dataType === 'realtime') {
            return {
                symbol: futuData.code,
                price: parseFloat(futuData.last_price || futuData.cur_price),
                open: parseFloat(futuData.open_price),
                high: parseFloat(futuData.high_price),
                low: parseFloat(futuData.low_price),
                previousClose: parseFloat(futuData.prev_close_price),
                change: parseFloat(futuData.change_rate),
                changePercent: parseFloat(futuData.change_rate),
                volume: parseInt(futuData.volume),
                turnover: parseFloat(futuData.turnover),
                timestamp: new Date().toISOString()
            };
        }
        return futuData;
    }
    
    /**
     * 生成模擬數據（當富途 API 不可用時）
     */
    generateSimulatedData(symbol, days = 365) {
        const data = [];
        const basePrice = 100 + Math.random() * 50;
        let currentPrice = basePrice;
        
        for (let i = days; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            
            const change = (Math.random() - 0.5) * 0.1;
            currentPrice = currentPrice * (1 + change);
            
            const open = currentPrice * (1 + (Math.random() - 0.5) * 0.02);
            const high = Math.max(open, currentPrice) * (1 + Math.random() * 0.02);
            const low = Math.min(open, currentPrice) * (1 - Math.random() * 0.02);
            const volume = Math.floor(Math.random() * 1000000) + 100000;
            
            data.push({
                date: date.toISOString().split('T')[0],
                open: parseFloat(open.toFixed(2)),
                high: parseFloat(high.toFixed(2)),
                low: parseFloat(low.toFixed(2)),
                close: parseFloat(currentPrice.toFixed(2)),
                volume: volume,
                turnover: volume * currentPrice
            });
        }
        
        return data;
    }
    
    /**
     * 生成模擬實時數據
     */
    generateSimulatedRealtimeData(symbol) {
        const basePrice = 100 + Math.random() * 50;
        const change = (Math.random() - 0.5) * 0.1;
        const currentPrice = basePrice * (1 + change);
        
        return {
            symbol: symbol,
            price: parseFloat(currentPrice.toFixed(2)),
            open: parseFloat((basePrice * (1 + (Math.random() - 0.5) * 0.02)).toFixed(2)),
            high: parseFloat((currentPrice * (1 + Math.random() * 0.02)).toFixed(2)),
            low: parseFloat((currentPrice * (1 - Math.random() * 0.02)).toFixed(2)),
            previousClose: parseFloat(basePrice.toFixed(2)),
            change: parseFloat((change * 100).toFixed(2)),
            changePercent: parseFloat((change * 100).toFixed(2)),
            volume: Math.floor(Math.random() * 1000000) + 100000,
            turnover: Math.floor(Math.random() * 100000000) + 10000000,
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = FutuDataSource;
