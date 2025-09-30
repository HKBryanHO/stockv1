#!/usr/bin/env node
/**
 * 測試金融數據源
 * 驗證 Polygon.io、Finnhub、FMP 數據源是否正常工作
 */

const FinancialDataSources = require('./financial_data_sources');

async function testDataSources() {
    console.log('🧪 測試金融數據源...\n');
    
    const dataSource = new FinancialDataSources();
    
    // 測試股票
    const testSymbols = ['AAPL', 'MSFT', 'GOOGL'];
    
    for (const symbol of testSymbols) {
        console.log(`📊 測試 ${symbol}...`);
        
        try {
            // 測試歷史數據
            console.log('  📈 獲取歷史數據...');
            const historicalResult = await dataSource.getHistoricalData(symbol, 30);
            
            if (historicalResult.success) {
                console.log(`  ✅ 歷史數據: ${historicalResult.source} - ${historicalResult.count} 條記錄`);
                if (historicalResult.warning) {
                    console.log(`  ⚠️ 警告: ${historicalResult.warning}`);
                }
            } else {
                console.log(`  ❌ 歷史數據獲取失敗`);
            }
            
            // 測試實時數據
            console.log('  📊 獲取實時數據...');
            const realtimeResult = await dataSource.getRealtimeData(symbol);
            
            if (realtimeResult.success) {
                console.log(`  ✅ 實時數據: ${realtimeResult.source} - $${realtimeResult.data.price}`);
                if (realtimeResult.warning) {
                    console.log(`  ⚠️ 警告: ${realtimeResult.warning}`);
                }
            } else {
                console.log(`  ❌ 實時數據獲取失敗`);
            }
            
        } catch (error) {
            console.log(`  ❌ 測試 ${symbol} 時發生錯誤: ${error.message}`);
        }
        
        console.log(''); // 空行分隔
    }
    
    // 測試數據源配置
    console.log('🔧 檢查 API 配置...');
    console.log(`  FMP API Key: ${dataSource.apiKeys.fmp ? '✅ 已配置' : '❌ 未配置'}`);
    console.log(`  Polygon API Key: ${dataSource.apiKeys.polygon ? '✅ 已配置' : '❌ 未配置'}`);
    console.log(`  Finnhub API Key: ${dataSource.apiKeys.finnhub ? '✅ 已配置' : '❌ 未配置'}`);
    
    console.log('\n🎉 測試完成！');
}

// 測試數據源連接
async function testConnections() {
    console.log('🔗 測試 API 連接...\n');
    
    const dataSource = new FinancialDataSources();
    
    // 測試 FMP 連接
    if (dataSource.apiKeys.fmp) {
        console.log('📡 測試 FMP API...');
        try {
            const result = await dataSource.fetchFromFMP('AAPL', 7);
            if (result && result.length > 0) {
                console.log(`  ✅ FMP: 成功獲取 ${result.length} 條記錄`);
            } else {
                console.log('  ❌ FMP: 無數據返回');
            }
        } catch (error) {
            console.log(`  ❌ FMP: 連接失敗 - ${error.message}`);
        }
    } else {
        console.log('  ⚠️ FMP: API Key 未配置');
    }
    
    // 測試 Polygon 連接
    if (dataSource.apiKeys.polygon) {
        console.log('📡 測試 Polygon API...');
        try {
            const result = await dataSource.fetchFromPolygon('AAPL', 7);
            if (result && result.length > 0) {
                console.log(`  ✅ Polygon: 成功獲取 ${result.length} 條記錄`);
            } else {
                console.log('  ❌ Polygon: 無數據返回');
            }
        } catch (error) {
            console.log(`  ❌ Polygon: 連接失敗 - ${error.message}`);
        }
    } else {
        console.log('  ⚠️ Polygon: API Key 未配置');
    }
    
    // 測試 Finnhub 連接
    if (dataSource.apiKeys.finnhub) {
        console.log('📡 測試 Finnhub API...');
        try {
            const result = await dataSource.fetchRealtimeFromFinnhub('AAPL');
            if (result && result.price) {
                console.log(`  ✅ Finnhub: 成功獲取實時價格 $${result.price}`);
            } else {
                console.log('  ❌ Finnhub: 無數據返回');
            }
        } catch (error) {
            console.log(`  ❌ Finnhub: 連接失敗 - ${error.message}`);
        }
    } else {
        console.log('  ⚠️ Finnhub: API Key 未配置');
    }
    
    console.log('\n🎉 連接測試完成！');
}

// 性能測試
async function performanceTest() {
    console.log('⚡ 性能測試...\n');
    
    const dataSource = new FinancialDataSources();
    const testSymbol = 'AAPL';
    const iterations = 5;
    
    console.log(`📊 測試 ${testSymbol} 的 ${iterations} 次請求...`);
    
    const startTime = Date.now();
    const results = [];
    
    for (let i = 0; i < iterations; i++) {
        const iterationStart = Date.now();
        
        try {
            const result = await dataSource.getHistoricalData(testSymbol, 30);
            const iterationTime = Date.now() - iterationStart;
            
            results.push({
                success: result.success,
                source: result.source,
                time: iterationTime,
                count: result.count
            });
            
            console.log(`  請求 ${i + 1}: ${result.source} - ${iterationTime}ms - ${result.count} 條記錄`);
            
        } catch (error) {
            console.log(`  請求 ${i + 1}: 失敗 - ${error.message}`);
            results.push({
                success: false,
                error: error.message,
                time: Date.now() - iterationStart
            });
        }
        
        // 避免請求過於頻繁
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    const totalTime = Date.now() - startTime;
    const successfulRequests = results.filter(r => r.success).length;
    const averageTime = results.reduce((sum, r) => sum + r.time, 0) / results.length;
    
    console.log('\n📈 性能統計:');
    console.log(`  總時間: ${totalTime}ms`);
    console.log(`  成功請求: ${successfulRequests}/${iterations}`);
    console.log(`  平均響應時間: ${averageTime.toFixed(2)}ms`);
    console.log(`  成功率: ${(successfulRequests / iterations * 100).toFixed(1)}%`);
    
    // 統計數據源使用情況
    const sourceStats = {};
    results.forEach(r => {
        if (r.success && r.source) {
            sourceStats[r.source] = (sourceStats[r.source] || 0) + 1;
        }
    });
    
    console.log('\n📊 數據源使用統計:');
    Object.entries(sourceStats).forEach(([source, count]) => {
        console.log(`  ${source}: ${count} 次`);
    });
    
    console.log('\n🎉 性能測試完成！');
}

// 主函數
async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'all';
    
    console.log('🚀 金融數據源測試工具\n');
    
    switch (command) {
        case 'test':
            await testDataSources();
            break;
        case 'connect':
            await testConnections();
            break;
        case 'performance':
            await performanceTest();
            break;
        case 'all':
        default:
            await testDataSources();
            await testConnections();
            await performanceTest();
            break;
    }
}

// 錯誤處理
process.on('unhandledRejection', (error) => {
    console.error('❌ 未處理的錯誤:', error);
    process.exit(1);
});

// 運行測試
if (require.main === module) {
    main().catch(error => {
        console.error('❌ 測試失敗:', error);
        process.exit(1);
    });
}

module.exports = {
    testDataSources,
    testConnections,
    performanceTest
};
