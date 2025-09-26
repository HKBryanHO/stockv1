#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

console.log('⚡ 快速添加查詢記錄...\n');

const dbPath = path.join(__dirname, 'database', 'users.db');
const db = new sqlite3.Database(dbPath);

// 快速添加查詢記錄
function quickAddQueries() {
    console.log('📝 添加查詢記錄...');
    
    const queries = [
        // 股票查詢
        { username: 'admin', type: 'stock', content: '查詢 AAPL 股價', result: 'AAPL 當前價格: $175.00，漲幅: +2.5%', metadata: '{"symbol":"AAPL","price":175.00}' },
        { username: 'admin', type: 'stock', content: '查詢 TSLA 股價', result: 'TSLA 當前價格: $245.50，漲幅: -1.2%', metadata: '{"symbol":"TSLA","price":245.50}' },
        { username: 'admin', type: 'stock', content: '查詢 MSFT 股價', result: 'MSFT 當前價格: $380.25，漲幅: +0.8%', metadata: '{"symbol":"MSFT","price":380.25}' },
        
        // AI 查詢
        { username: 'admin', type: 'ai', content: 'AI，請解釋什麼是量化交易？', result: '量化交易是利用數學模型和算法來執行交易策略的投資方法。', metadata: '{"model":"GPT-4","category":"education"}' },
        { username: 'admin', type: 'ai', content: '分析比特幣的技術指標', result: '根據技術分析，比特幣目前處於關鍵支撐位附近。RSI 指標顯示超賣狀態。', metadata: '{"symbol":"BTC","analysis_type":"technical"}' },
        { username: 'admin', type: 'ai', content: '什麼是投資組合優化？', result: '投資組合優化是通過數學方法找到最佳資產配置的過程。', metadata: '{"model":"GPT-4","category":"portfolio_management"}' },
        { username: 'admin', type: 'ai', content: '解釋什麼是期權交易策略', result: '期權交易策略是利用期權合約進行投資的方法。常見策略包括買入看漲期權、買入看跌期權等。', metadata: '{"model":"GPT-4","category":"options_trading"}' },
        { username: 'admin', type: 'ai', content: '如何評估股票的基本面？', result: '股票基本面分析主要從財務指標、行業分析、公司治理、宏觀環境等維度評估。', metadata: '{"model":"GPT-4","category":"fundamental_analysis"}' },
        
        // 預測查詢
        { username: 'admin', type: 'prediction', content: '預測 TSLA 下週走勢', result: 'TSLA 下週預計波動較大，可能上漲至 $250-260 區間。', metadata: '{"symbol":"TSLA","prediction":"bullish","timeframe":"1w"}' },
        { username: 'admin', type: 'prediction', content: '預測 BTC 未來30天走勢', result: 'BTC 未來30天可能出現反彈，目標價位 $30,000-35,000。', metadata: '{"symbol":"BTC","prediction":"bullish","timeframe":"30d"}' },
        
        // 分析查詢
        { username: 'admin', type: 'analysis', content: '分析科技股板塊的投資機會', result: '科技股板塊目前估值合理，AI、雲計算、半導體等子板塊表現強勁。', metadata: '{"sector":"technology","analysis_type":"sector"}' },
        { username: 'admin', type: 'analysis', content: '分析當前市場風險因素', result: '當前市場主要風險因素：通脹壓力、利率政策不確定性、地緣政治緊張。', metadata: '{"risk_type":"market","factors":["inflation","rates","geopolitics"]}' }
    ];
    
    console.log(`📊 準備插入 ${queries.length} 條查詢記錄...`);
    
    let completed = 0;
    queries.forEach((query, i) => {
        db.run(
            'INSERT INTO user_queries (username, type, content, result, metadata) VALUES (?, ?, ?, ?, ?)',
            [query.username, query.type, query.content, query.result, query.metadata],
            function(err) {
                if (err) {
                    console.warn(`⚠️ 插入 ${i + 1} 失敗:`, err.message);
                } else {
                    console.log(`✅ 查詢 ${i + 1} 插入成功 (ID: ${this.lastID}) - ${query.type}`);
                }
                
                completed++;
                if (completed === queries.length) {
                    // 驗證結果
                    db.get(`
                        SELECT 
                            COUNT(*) as total_queries,
                            COUNT(CASE WHEN type = 'stock' THEN 1 END) as stock_queries,
                            COUNT(CASE WHEN type = 'ai' THEN 1 END) as ai_queries,
                            COUNT(CASE WHEN type = 'prediction' THEN 1 END) as prediction_queries,
                            COUNT(CASE WHEN type = 'analysis' THEN 1 END) as analysis_queries,
                            COUNT(CASE WHEN date(created_at) = date('now') THEN 1 END) as today_queries
                        FROM user_queries
                    `, (err, stats) => {
                        if (err) {
                            console.error('❌ 獲取統計失敗:', err.message);
                        } else {
                            console.log('\n📊 查詢記錄統計:');
                            console.log(`   總查詢數: ${stats.total_queries}`);
                            console.log(`   股票查詢: ${stats.stock_queries}`);
                            console.log(`   AI 查詢: ${stats.ai_queries}`);
                            console.log(`   預測查詢: ${stats.prediction_queries}`);
                            console.log(`   分析查詢: ${stats.analysis_queries}`);
                            console.log(`   今日查詢: ${stats.today_queries}`);
                        }
                        
                        console.log('\n🎯 查詢記錄添加完成！');
                        console.log('\n🌐 測試頁面:');
                        console.log('   查詢記錄: https://www.bma-hk.com/admin-queries');
                        console.log('   用戶管理: https://www.bma-hk.com/admin');
                        
                        console.log('\n🔧 如果查詢記錄仍不顯示:');
                        console.log('1. 清除瀏覽器緩存');
                        console.log('2. 重新登入管理員帳戶');
                        console.log('3. 檢查服務器日誌');
                        console.log('4. 確認 API 端點正常');
                        
                        db.close();
                    });
                }
            }
        );
    });
}

// 開始添加查詢記錄
quickAddQueries();
