#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

console.log('🤖 快速添加 AI 查詢記錄...\n');

const dbPath = path.join(__dirname, 'database', 'users.db');
const db = new sqlite3.Database(dbPath);

// 直接插入 AI 查詢記錄
const aiQueries = [
    {
        username: 'admin',
        type: 'ai',
        content: 'AI，請解釋什麼是量化交易？',
        result: '量化交易是利用數學模型和算法來執行交易策略的投資方法。它通過分析大量歷史數據，識別市場模式和機會，自動執行買賣決策。',
        metadata: '{"model":"GPT-4","category":"education"}'
    },
    {
        username: 'admin',
        type: 'ai',
        content: '分析比特幣的技術指標',
        result: '根據技術分析，比特幣目前處於關鍵支撐位附近。RSI 指標顯示超賣狀態，MACD 呈現死叉信號，但成交量有所增加。',
        metadata: '{"symbol":"BTC","analysis_type":"technical"}'
    },
    {
        username: 'admin',
        type: 'ai',
        content: '什麼是投資組合優化？',
        result: '投資組合優化是通過數學方法找到最佳資產配置的過程。主要目標是在給定風險水平下最大化收益，或在給定收益目標下最小化風險。',
        metadata: '{"model":"GPT-4","category":"portfolio_management"}'
    },
    {
        username: 'admin',
        type: 'ai',
        content: '解釋什麼是期權交易策略',
        result: '期權交易策略是利用期權合約進行投資的方法。常見策略包括買入看漲期權、買入看跌期權、備兌看漲期權等。',
        metadata: '{"model":"GPT-4","category":"options_trading"}'
    },
    {
        username: 'admin',
        type: 'ai',
        content: '如何評估股票的基本面？',
        result: '股票基本面分析主要從財務指標、行業分析、公司治理、宏觀環境等維度評估公司的內在價值和投資價值。',
        metadata: '{"model":"GPT-4","category":"fundamental_analysis"}'
    }
];

console.log('📝 插入 AI 查詢記錄...');

let completed = 0;
aiQueries.forEach((query, i) => {
    db.run(
        'INSERT INTO user_queries (username, type, content, result, metadata) VALUES (?, ?, ?, ?, ?)',
        [query.username, query.type, query.content, query.result, query.metadata],
        function(err) {
            if (err) {
                console.warn(`⚠️ 插入 ${i + 1} 失敗:`, err.message);
            } else {
                console.log(`✅ AI 查詢 ${i + 1} 插入成功 (ID: ${this.lastID})`);
            }
            
            completed++;
            if (completed === aiQueries.length) {
                // 驗證結果
                db.get('SELECT COUNT(*) as count FROM user_queries WHERE type = "ai"', (err, row) => {
                    if (err) {
                        console.error('❌ 驗證失敗:', err.message);
                    } else {
                        console.log(`\n✅ 數據庫中現有 AI 查詢記錄: ${row.count} 條`);
                    }
                    
                    // 顯示統計
                    db.get(`
                        SELECT 
                            COUNT(*) as total_queries,
                            COUNT(CASE WHEN type = 'stock' THEN 1 END) as stock_queries,
                            COUNT(CASE WHEN type = 'ai' THEN 1 END) as ai_queries,
                            COUNT(CASE WHEN type = 'prediction' THEN 1 END) as prediction_queries
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
                        }
                        
                        console.log('\n🎯 AI 查詢記錄添加完成！');
                        console.log('🌐 訪問: https://www.bma-hk.com/admin-queries');
                        
                        db.close();
                    });
                });
            }
        }
    );
});
