#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

console.log('📝 添加示例查詢記錄...\n');

const dbPath = path.join(__dirname, 'database', 'users.db');
const db = new sqlite3.Database(dbPath);

// 添加示例查詢記錄
function addSampleQueries() {
    console.log('🔄 開始添加示例查詢記錄...');
    
    const sampleQueries = [
        // 股票查詢
        {
            username: 'admin',
            type: 'stock',
            content: '查詢蘋果公司 (AAPL) 股價',
            result: 'AAPL 當前價格: $175.00，漲幅: +2.5%，成交量: 45.2M',
            metadata: JSON.stringify({ symbol: 'AAPL', price: 175.00, change: 2.5, volume: '45.2M' })
        },
        {
            username: 'admin',
            type: 'stock',
            content: '查詢特斯拉 (TSLA) 股票信息',
            result: 'TSLA 當前價格: $245.50，漲幅: -1.2%，市值: $780B',
            metadata: JSON.stringify({ symbol: 'TSLA', price: 245.50, change: -1.2, market_cap: '780B' })
        },
        {
            username: 'admin',
            type: 'stock',
            content: '查詢微軟 (MSFT) 股價走勢',
            result: 'MSFT 當前價格: $380.25，漲幅: +0.8%，52週高點: $384.30',
            metadata: JSON.stringify({ symbol: 'MSFT', price: 380.25, change: 0.8, high_52w: 384.30 })
        },
        // AI 查詢
        {
            username: 'admin',
            type: 'ai',
            content: 'AI，請解釋什麼是量化交易？',
            result: '量化交易是利用數學模型和算法來執行交易策略的投資方法。它通過分析大量歷史數據，識別市場模式和機會，自動執行買賣決策。主要特點包括：1) 數據驅動決策 2) 消除情緒影響 3) 高頻交易能力 4) 風險管理自動化。',
            metadata: JSON.stringify({ model: 'GPT-4', category: 'education', confidence: 0.95 })
        },
        {
            username: 'admin',
            type: 'ai',
            content: '分析比特幣的技術指標',
            result: '根據技術分析，比特幣目前處於關鍵支撐位附近。RSI 指標顯示超賣狀態 (RSI: 28)，MACD 呈現死叉信號，但成交量有所增加。建議關注 $25,000 支撐位，如果跌破可能測試 $20,000。',
            metadata: JSON.stringify({ symbol: 'BTC', analysis_type: 'technical', indicators: ['RSI', 'MACD', 'Volume'] })
        },
        {
            username: 'admin',
            type: 'ai',
            content: '什麼是投資組合優化？',
            result: '投資組合優化是通過數學方法找到最佳資產配置的過程。主要目標是在給定風險水平下最大化收益，或在給定收益目標下最小化風險。常用方法包括：1) 馬科維茨均值-方差模型 2) 風險平價策略 3) 因子模型 4) 動態對沖策略。',
            metadata: JSON.stringify({ model: 'GPT-4', category: 'portfolio_management', confidence: 0.92 })
        },
        {
            username: 'admin',
            type: 'ai',
            content: '解釋什麼是期權交易策略',
            result: '期權交易策略是利用期權合約進行投資的方法。常見策略包括：1) 買入看漲期權 (Long Call) - 看漲市場 2) 買入看跌期權 (Long Put) - 看跌市場 3) 備兌看漲期權 (Covered Call) - 增加收益 4) 保護性看跌期權 (Protective Put) - 對沖風險。',
            metadata: JSON.stringify({ model: 'GPT-4', category: 'options_trading', confidence: 0.88 })
        },
        {
            username: 'admin',
            type: 'ai',
            content: '如何評估股票的基本面？',
            result: '股票基本面分析主要從以下幾個維度評估：1) 財務指標：PE比率、PB比率、ROE、負債比率等 2) 行業分析：行業成長性、競爭格局、監管環境 3) 公司治理：管理層能力、股權結構、企業文化 4) 宏觀環境：經濟週期、利率環境、政策影響。',
            metadata: JSON.stringify({ model: 'GPT-4', category: 'fundamental_analysis', confidence: 0.90 })
        },
        // 預測查詢
        {
            username: 'admin',
            type: 'prediction',
            content: '預測特斯拉 (TSLA) 下週走勢',
            result: '根據技術分析和市場情緒，TSLA 下週預計波動較大，可能上漲至 $250-260 區間。關鍵支撐位在 $240，阻力位在 $260。建議關注成交量變化。',
            metadata: JSON.stringify({ symbol: 'TSLA', prediction: 'bullish', timeframe: '1w', confidence: 0.75 })
        },
        {
            username: 'admin',
            type: 'prediction',
            content: '預測比特幣 (BTC) 未來30天走勢',
            result: 'BTC 未來30天可能出現反彈，目標價位 $30,000-35,000。技術指標顯示超賣，但需要成交量確認。建議分批建倉。',
            metadata: JSON.stringify({ symbol: 'BTC', prediction: 'bullish', timeframe: '30d', confidence: 0.70 })
        },
        // 分析查詢
        {
            username: 'admin',
            type: 'analysis',
            content: '分析科技股板塊的投資機會',
            result: '科技股板塊目前估值合理，AI、雲計算、半導體等子板塊表現強勁。建議關注：1) AI 相關公司 2) 雲計算服務商 3) 半導體龍頭 4) 新能源汽車。風險：監管政策、利率變化、地緣政治。',
            metadata: JSON.stringify({ sector: 'technology', analysis_type: 'sector', recommendations: ['AI', 'cloud', 'semiconductor', 'EV'] })
        },
        {
            username: 'admin',
            type: 'analysis',
            content: '分析當前市場風險因素',
            result: '當前市場主要風險因素：1) 通脹壓力持續 2) 利率政策不確定性 3) 地緣政治緊張 4) 企業盈利預期下調。建議：分散投資、控制倉位、關注防禦性板塊。',
            metadata: JSON.stringify({ risk_type: 'market', factors: ['inflation', 'rates', 'geopolitics', 'earnings'], recommendation: 'defensive' })
        }
    ];
    
    console.log(`📊 準備插入 ${sampleQueries.length} 條查詢記錄...`);
    
    let successCount = 0;
    let errorCount = 0;
    
    sampleQueries.forEach((query, i) => {
        db.run(
            'INSERT INTO user_queries (username, type, content, result, metadata) VALUES (?, ?, ?, ?, ?)',
            [query.username, query.type, query.content, query.result, query.metadata],
            function(err) {
                if (err) {
                    console.warn(`⚠️ 插入查詢 ${i + 1} 失敗:`, err.message);
                    errorCount++;
                } else {
                    console.log(`✅ 查詢 ${i + 1} 插入成功 (ID: ${this.lastID}) - ${query.type}`);
                    successCount++;
                }
                
                // 檢查是否所有查詢都處理完成
                if (successCount + errorCount === sampleQueries.length) {
                    console.log(`\n📈 插入完成統計:`);
                    console.log(`   成功: ${successCount} 條`);
                    console.log(`   失敗: ${errorCount} 條`);
                    console.log(`   總計: ${sampleQueries.length} 條`);
                    
                    // 驗證插入結果
                    console.log('\n🔍 驗證插入結果...');
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
                        
                        console.log('\n🎯 示例查詢記錄添加完成！');
                        console.log('\n🌐 測試頁面:');
                        console.log('   查詢記錄: https://www.bma-hk.com/admin-queries');
                        console.log('   用戶管理: https://www.bma-hk.com/admin');
                        console.log('   基本登入: https://www.bma-hk.com/basic-login.html');
                        
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

// 開始添加示例查詢記錄
addSampleQueries();
