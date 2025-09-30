/**
 * 富途 API 高級功能模組
 * 基於富途 API 文檔 v9.4 的深化功能
 */

class FutuAdvancedFeatures {
    constructor() {
        this.subscriptions = new Map();
        this.realtimeData = new Map();
        this.capitalFlowData = new Map();
        this.marketStateData = new Map();
    }

    /**
     * 實時訂閱管理
     */
    async subscribeRealtimeData(symbols, dataTypes = ['quote', 'kline', 'orderbook']) {
        console.log(`📡 訂閱實時數據: ${symbols.join(', ')}`);
        
        try {
            // 調用富途 API 訂閱功能
            const response = await fetch('/futu/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symbols: symbols,
                    dataTypes: dataTypes
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                symbols.forEach(symbol => {
                    this.subscriptions.set(symbol, {
                        symbols: symbols,
                        dataTypes: dataTypes,
                        timestamp: Date.now()
                    });
                });
                
                console.log(`✅ 成功訂閱 ${symbols.length} 隻股票`);
                return result;
            }
            
        } catch (error) {
            console.error('❌ 訂閱失敗:', error);
            throw error;
        }
    }

    /**
     * 取消訂閱
     */
    async unsubscribeRealtimeData(symbols) {
        console.log(`📡 取消訂閱: ${symbols.join(', ')}`);
        
        try {
            const response = await fetch('/futu/unsubscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbols: symbols })
            });
            
            const result = await response.json();
            
            if (result.success) {
                symbols.forEach(symbol => {
                    this.subscriptions.delete(symbol);
                });
                
                console.log(`✅ 成功取消訂閱 ${symbols.length} 隻股票`);
                return result;
            }
            
        } catch (error) {
            console.error('❌ 取消訂閱失敗:', error);
            throw error;
        }
    }

    /**
     * 查詢訂閱狀態
     */
    async querySubscriptionStatus() {
        try {
            const response = await fetch('/futu/query-subscription');
            const result = await response.json();
            
            console.log('📊 當前訂閱狀態:', result.data);
            return result;
            
        } catch (error) {
            console.error('❌ 查詢訂閱狀態失敗:', error);
            throw error;
        }
    }

    /**
     * 獲取資金流向數據
     */
    async getCapitalFlow(symbols) {
        console.log(`💰 獲取資金流向: ${symbols.join(', ')}`);
        
        try {
            const response = await fetch('/futu/capital-flow', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbols: symbols })
            });
            
            const result = await response.json();
            
            if (result.success) {
                result.data.forEach(item => {
                    this.capitalFlowData.set(item.symbol, item);
                });
                
                console.log(`✅ 成功獲取 ${result.data.length} 隻股票資金流向`);
                return result;
            }
            
        } catch (error) {
            console.error('❌ 獲取資金流向失敗:', error);
            throw error;
        }
    }

    /**
     * 獲取資金分布
     */
    async getCapitalDistribution(symbols) {
        console.log(`📊 獲取資金分布: ${symbols.join(', ')}`);
        
        try {
            const response = await fetch('/futu/capital-distribution', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbols: symbols })
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log(`✅ 成功獲取 ${result.data.length} 隻股票資金分布`);
                return result;
            }
            
        } catch (error) {
            console.error('❌ 獲取資金分布失敗:', error);
            throw error;
        }
    }

    /**
     * 獲取所屬板塊
     */
    async getOwnerPlate(symbols) {
        console.log(`🏢 獲取所屬板塊: ${symbols.join(', ')}`);
        
        try {
            const response = await fetch('/futu/owner-plate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbols: symbols })
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log(`✅ 成功獲取 ${result.data.length} 隻股票所屬板塊`);
                return result;
            }
            
        } catch (error) {
            console.error('❌ 獲取所屬板塊失敗:', error);
            throw error;
        }
    }

    /**
     * 獲取市場狀態
     */
    async getMarketState(markets = ['HK', 'US', 'CN']) {
        console.log(`🌍 獲取市場狀態: ${markets.join(', ')}`);
        
        try {
            const response = await fetch('/futu/market-state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ markets: markets })
            });
            
            const result = await response.json();
            
            if (result.success) {
                result.data.forEach(market => {
                    this.marketStateData.set(market.market, market);
                });
                
                console.log(`✅ 成功獲取 ${result.data.length} 個市場狀態`);
                return result;
            }
            
        } catch (error) {
            console.error('❌ 獲取市場狀態失敗:', error);
            throw error;
        }
    }

    /**
     * 獲取交易日曆
     */
    async getTradingDays(market, startDate, endDate) {
        console.log(`📅 獲取交易日曆: ${market} (${startDate} - ${endDate})`);
        
        try {
            const response = await fetch('/futu/trading-days', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    market: market,
                    startDate: startDate,
                    endDate: endDate
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log(`✅ 成功獲取 ${result.data.length} 個交易日`);
                return result;
            }
            
        } catch (error) {
            console.error('❌ 獲取交易日曆失敗:', error);
            throw error;
        }
    }

    /**
     * 條件選股
     */
    async stockFilter(criteria) {
        console.log('🔍 執行條件選股...');
        
        try {
            const response = await fetch('/futu/stock-filter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ criteria: criteria })
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log(`✅ 條件選股完成，找到 ${result.data.length} 隻股票`);
                return result;
            }
            
        } catch (error) {
            console.error('❌ 條件選股失敗:', error);
            throw error;
        }
    }

    /**
     * 獲取板塊股票
     */
    async getPlateStocks(plateCode) {
        console.log(`📈 獲取板塊股票: ${plateCode}`);
        
        try {
            const response = await fetch('/futu/plate-stocks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plateCode: plateCode })
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log(`✅ 成功獲取板塊 ${plateCode} 的 ${result.data.length} 隻股票`);
                return result;
            }
            
        } catch (error) {
            console.error('❌ 獲取板塊股票失敗:', error);
            throw error;
        }
    }

    /**
     * 設置到價提醒
     */
    async setPriceReminder(symbol, targetPrice, condition = 'greater') {
        console.log(`🔔 設置到價提醒: ${symbol} @ ${targetPrice}`);
        
        try {
            const response = await fetch('/futu/price-reminder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symbol: symbol,
                    targetPrice: targetPrice,
                    condition: condition
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log(`✅ 成功設置到價提醒`);
                return result;
            }
            
        } catch (error) {
            console.error('❌ 設置到價提醒失敗:', error);
            throw error;
        }
    }

    /**
     * 獲取自選股分組
     */
    async getUserSecurityGroups() {
        console.log('📋 獲取自選股分組...');
        
        try {
            const response = await fetch('/futu/user-security-groups');
            const result = await response.json();
            
            if (result.success) {
                console.log(`✅ 成功獲取 ${result.data.length} 個自選股分組`);
                return result;
            }
            
        } catch (error) {
            console.error('❌ 獲取自選股分組失敗:', error);
            throw error;
        }
    }

    /**
     * 獲取自選股列表
     */
    async getUserSecurities(groupId) {
        console.log(`📋 獲取自選股列表: 分組 ${groupId}`);
        
        try {
            const response = await fetch('/futu/user-securities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ groupId: groupId })
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log(`✅ 成功獲取 ${result.data.length} 隻自選股`);
                return result;
            }
            
        } catch (error) {
            console.error('❌ 獲取自選股列表失敗:', error);
            throw error;
        }
    }

    /**
     * 修改自選股
     */
    async modifyUserSecurities(groupId, symbols, operation = 'add') {
        console.log(`📝 修改自選股: ${operation} ${symbols.join(', ')}`);
        
        try {
            const response = await fetch('/futu/modify-user-securities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    groupId: groupId,
                    symbols: symbols,
                    operation: operation
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log(`✅ 成功修改自選股`);
                return result;
            }
            
        } catch (error) {
            console.error('❌ 修改自選股失敗:', error);
            throw error;
        }
    }
}

module.exports = FutuAdvancedFeatures;
