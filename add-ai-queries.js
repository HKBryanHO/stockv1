#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

console.log('🤖 添加 AI 查詢記錄...\n');

// 數據庫路徑
const dbPath = path.join(__dirname, 'database', 'users.db');

// 創建數據庫連接
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ 無法連接數據庫:', err.message);
        process.exit(1);
    }
    console.log('✅ 已連接到數據庫:', dbPath);
});

// 添加 AI 查詢記錄
function addAIQueries() {
    console.log('📝 添加 AI 查詢記錄...');
    
    const aiQueries = [
        {
            username: 'admin',
            type: 'ai',
            content: 'AI，請解釋什麼是量化交易？',
            result: '量化交易是利用數學模型和算法來執行交易策略的投資方法。它通過分析大量歷史數據，識別市場模式和機會，自動執行買賣決策。主要特點包括：1) 數據驅動決策 2) 消除情緒影響 3) 高頻交易能力 4) 風險管理自動化。',
            metadata: JSON.stringify({ 
                model: 'GPT-4', 
                category: 'education', 
                confidence: 0.95,
                tokens_used: 150
            })
        },
        {
            username: 'admin',
            type: 'ai',
            content: '分析比特幣的技術指標',
            result: '根據技術分析，比特幣目前處於關鍵支撐位附近。RSI 指標顯示超賣狀態 (RSI: 28)，MACD 呈現死叉信號，但成交量有所增加。建議關注 $25,000 支撐位，如果跌破可能測試 $20,000。短期內可能出現反彈，但需要成交量確認。',
            metadata: JSON.stringify({ 
                symbol: 'BTC', 
                analysis_type: 'technical', 
                indicators: ['RSI', 'MACD', 'Volume'],
                confidence: 0.78
            })
        },
        {
            username: 'admin',
            type: 'ai',
            content: '什麼是投資組合優化？',
            result: '投資組合優化是通過數學方法找到最佳資產配置的過程。主要目標是在給定風險水平下最大化收益，或在給定收益目標下最小化風險。常用方法包括：1) 馬科維茨均值-方差模型 2) 風險平價策略 3) 因子模型 4) 動態對沖策略。關鍵是平衡收益與風險，實現長期穩定的投資回報。',
            metadata: JSON.stringify({ 
                model: 'GPT-4', 
                category: 'portfolio_management', 
                confidence: 0.92,
                complexity: 'intermediate'
            })
        },
        {
            username: 'admin',
            type: 'ai',
            content: '解釋什麼是期權交易策略',
            result: '期權交易策略是利用期權合約進行投資的方法。常見策略包括：1) 買入看漲期權 (Long Call) - 看漲市場 2) 買入看跌期權 (Long Put) - 看跌市場 3) 備兌看漲期權 (Covered Call) - 增加收益 4) 保護性看跌期權 (Protective Put) - 對沖風險 5) 跨式策略 (Straddle) - 波動率交易。每種策略都有不同的風險收益特徵，適合不同的市場環境。',
            metadata: JSON.stringify({ 
                model: 'GPT-4', 
                category: 'options_trading', 
                confidence: 0.88,
                risk_level: 'high'
            })
        },
        {
            username: 'admin',
            type: 'ai',
            content: '如何評估股票的基本面？',
            result: '股票基本面分析主要從以下幾個維度評估：1) 財務指標：PE比率、PB比率、ROE、負債比率等 2) 行業分析：行業成長性、競爭格局、監管環境 3) 公司治理：管理層能力、股權結構、企業文化 4) 宏觀環境：經濟週期、利率環境、政策影響。綜合這些因素可以判斷公司的內在價值和投資價值。',
            metadata: JSON.stringify({ 
                model: 'GPT-4', 
                category: 'fundamental_analysis', 
                confidence: 0.90,
                analysis_depth: 'comprehensive'
            })
        },
        {
            username: 'admin',
            type: 'ai',
            content: '什麼是風險管理？',
            result: '風險管理是投資過程中識別、評估和控制風險的系統性方法。主要步驟包括：1) 風險識別：市場風險、信用風險、流動性風險、操作風險 2) 風險測量：VaR、壓力測試、情景分析 3) 風險控制：分散投資、對沖策略、止損設置 4) 風險監控：實時監控、定期評估、調整策略。有效的風險管理是長期投資成功的關鍵。',
            metadata: JSON.stringify({ 
                model: 'GPT-4', 
                category: 'risk_management', 
                confidence: 0.93,
                importance: 'critical'
            })
        },
        {
            username: 'admin',
            type: 'ai',
            content: '分析當前市場趨勢',
            result: '根據最新市場數據分析，當前市場呈現以下特徵：1) 科技股表現強勁，AI相關股票領漲 2) 能源板塊受油價波動影響較大 3) 金融股在利率環境下表現分化 4) 新興市場貨幣面臨壓力。建議關注：AI、新能源、醫療科技等成長性行業，同時注意控制倉位和風險。',
            metadata: JSON.stringify({ 
                model: 'GPT-4', 
                category: 'market_analysis', 
                confidence: 0.75,
                market_sentiment: 'neutral_bullish',
                sectors: ['tech', 'energy', 'finance']
            })
        },
        {
            username: 'admin',
            type: 'ai',
            content: '什麼是算法交易？',
            result: '算法交易是使用預設的計算機程序自動執行交易決策的方法。主要類型包括：1) 趨勢跟隨算法：識別和跟隨市場趨勢 2) 均值回歸算法：利用價格偏離均值後的回歸特性 3) 套利算法：利用不同市場間的價格差異 4) 高頻交易算法：利用微秒級的時間優勢。算法交易可以提高執行效率，減少情緒影響，但需要強大的技術基礎。',
            metadata: JSON.stringify({ 
                model: 'GPT-4', 
                category: 'algorithmic_trading', 
                confidence: 0.89,
                technical_complexity: 'high'
            })
        }
    ];
    
    const insertSQL = `INSERT INTO user_queries (username, type, content, result, metadata) VALUES (?, ?, ?, ?, ?)`;
    
    console.log(`📊 準備插入 ${aiQueries.length} 條 AI 查詢記錄...`);
    
    let successCount = 0;
    let errorCount = 0;
    
    aiQueries.forEach((query, i) => {
        db.run(insertSQL, [query.username, query.type, query.content, query.result, query.metadata], function(err) {
            if (err) {
                console.warn(`⚠️ 插入 AI 查詢 ${i + 1} 失敗:`, err.message);
                errorCount++;
            } else {
                console.log(`✅ AI 查詢 ${i + 1} 插入成功 (ID: ${this.lastID})`);
                successCount++;
            }
            
            // 檢查是否所有查詢都處理完成
            if (successCount + errorCount === aiQueries.length) {
                console.log(`\n📈 插入完成統計:`);
                console.log(`   成功: ${successCount} 條`);
                console.log(`   失敗: ${errorCount} 條`);
                console.log(`   總計: ${aiQueries.length} 條`);
                
                // 驗證插入結果
                console.log('\n🔍 驗證插入結果...');
                db.get('SELECT COUNT(*) as count FROM user_queries WHERE type = "ai"', (err, row) => {
                    if (err) {
                        console.error('❌ 驗證失敗:', err.message);
                    } else {
                        console.log(`✅ 數據庫中現有 AI 查詢記錄: ${row.count} 條`);
                    }
                    
                    // 顯示統計信息
                    db.get(`
                        SELECT 
                            COUNT(*) as total_queries,
                            COUNT(CASE WHEN type = 'stock' THEN 1 END) as stock_queries,
                            COUNT(CASE WHEN type = 'ai' THEN 1 END) as ai_queries,
                            COUNT(CASE WHEN type = 'prediction' THEN 1 END) as prediction_queries,
                            COUNT(CASE WHEN type = 'analysis' THEN 1 END) as analysis_queries
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
                        }
                        
                        console.log('\n🎯 AI 查詢記錄添加完成！');
                        console.log('\n🌐 訪問頁面:');
                        console.log('   查詢記錄: https://www.bma-hk.com/admin-queries');
                        console.log('   用戶管理: https://www.bma-hk.com/admin');
                        
                        db.close();
                    });
                });
            }
        });
    });
}

// 開始添加 AI 查詢記錄
addAIQueries();
