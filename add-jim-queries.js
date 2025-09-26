#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

console.log('👤 為 Jim 用戶添加真實查詢記錄...\n');

const dbPath = path.join(__dirname, 'database', 'users.db');
const db = new sqlite3.Database(dbPath);

// 為 Jim 用戶添加查詢記錄
function addJimQueries() {
    console.log('📝 添加 Jim 用戶的查詢記錄...');
    
    const jimQueries = [
        // 股票查詢
        {
            username: 'jim',
            type: 'stock',
            content: '查詢蘋果公司 (AAPL) 最新股價',
            result: 'AAPL 當前價格: $175.25，今日漲幅: +1.8%，成交量: 45.2M',
            metadata: JSON.stringify({ symbol: 'AAPL', price: 175.25, change: 1.8, volume: '45.2M' })
        },
        {
            username: 'jim',
            type: 'stock',
            content: '查詢特斯拉 (TSLA) 股票走勢',
            result: 'TSLA 當前價格: $248.50，今日漲幅: -0.5%，市值: $790B',
            metadata: JSON.stringify({ symbol: 'TSLA', price: 248.50, change: -0.5, market_cap: '790B' })
        },
        {
            username: 'jim',
            type: 'stock',
            content: '查詢微軟 (MSFT) 股價表現',
            result: 'MSFT 當前價格: $382.15，今日漲幅: +0.9%，52週高點: $384.30',
            metadata: JSON.stringify({ symbol: 'MSFT', price: 382.15, change: 0.9, high_52w: 384.30 })
        },
        {
            username: 'jim',
            type: 'stock',
            content: '查詢谷歌 (GOOGL) 股票信息',
            result: 'GOOGL 當前價格: $142.80，今日漲幅: +2.1%，市值: $1.8T',
            metadata: JSON.stringify({ symbol: 'GOOGL', price: 142.80, change: 2.1, market_cap: '1.8T' })
        },
        
        // AI 查詢
        {
            username: 'jim',
            type: 'ai',
            content: 'AI，請分析當前科技股的投資機會',
            result: '根據最新市場分析，科技股板塊呈現以下投資機會：1) AI 相關公司表現強勁 2) 雲計算服務商增長穩定 3) 半導體行業復甦跡象明顯 4) 新能源汽車板塊估值合理。建議關注：AAPL、MSFT、NVDA、TSLA 等龍頭股。',
            metadata: JSON.stringify({ model: 'GPT-4', category: 'investment_analysis', confidence: 0.85 })
        },
        {
            username: 'jim',
            type: 'ai',
            content: '什麼是價值投資策略？',
            result: '價值投資是一種投資策略，專注於尋找被市場低估的股票。主要原則包括：1) 尋找低市盈率股票 2) 關注公司基本面 3) 長期持有策略 4) 安全邊際原則。代表人物如巴菲特，通過分析公司內在價值來做出投資決策。',
            metadata: JSON.stringify({ model: 'GPT-4', category: 'investment_education', confidence: 0.92 })
        },
        {
            username: 'jim',
            type: 'ai',
            content: '如何評估股票的風險？',
            result: '股票風險評估主要從以下幾個維度：1) 財務風險：負債比率、流動比率 2) 市場風險：Beta 係數、波動率 3) 行業風險：競爭格局、監管環境 4) 宏觀風險：經濟週期、利率變化。建議使用多種指標綜合評估，並建立風險控制機制。',
            metadata: JSON.stringify({ model: 'GPT-4', category: 'risk_management', confidence: 0.88 })
        },
        
        // 預測查詢
        {
            username: 'jim',
            type: 'prediction',
            content: '預測蘋果 (AAPL) 下個月走勢',
            result: '根據技術分析和基本面，AAPL 下個月可能出現以下走勢：1) 短期可能回調至 $170-175 區間 2) 中期目標價位 $180-185 3) 關鍵支撐位 $165 4) 建議分批建倉，控制風險。',
            metadata: JSON.stringify({ symbol: 'AAPL', prediction: 'neutral_bullish', timeframe: '1M', confidence: 0.75 })
        },
        {
            username: 'jim',
            type: 'prediction',
            content: '預測比特幣 (BTC) 未來走勢',
            result: 'BTC 未來走勢分析：1) 短期可能測試 $25,000 支撐位 2) 中期目標價位 $30,000-35,000 3) 長期看好，但需注意監管風險 4) 建議小倉位參與，控制風險。',
            metadata: JSON.stringify({ symbol: 'BTC', prediction: 'bullish', timeframe: '3M', confidence: 0.70 })
        },
        
        // 分析查詢
        {
            username: 'jim',
            type: 'analysis',
            content: '分析當前市場的投資環境',
            result: '當前市場投資環境分析：1) 宏觀環境：通脹壓力緩解，利率政策趨於穩定 2) 行業輪動：科技股領漲，能源股調整 3) 風險因素：地緣政治、監管政策 4) 投資建議：分散投資，關注成長性行業。',
            metadata: JSON.stringify({ analysis_type: 'market_overview', sectors: ['tech', 'energy', 'finance'], recommendation: 'diversified' })
        },
        {
            username: 'jim',
            type: 'analysis',
            content: '分析我的投資組合風險',
            result: '投資組合風險分析：1) 集中度風險：科技股佔比過高 2) 流動性風險：部分小盤股流動性不足 3) 匯率風險：海外投資受匯率影響 4) 建議：增加防禦性板塊，控制單一股票倉位。',
            metadata: JSON.stringify({ analysis_type: 'portfolio_risk', risks: ['concentration', 'liquidity', 'currency'], recommendation: 'rebalance' })
        }
    ];
    
    console.log(`📊 準備插入 ${jimQueries.length} 條 Jim 用戶查詢記錄...`);
    
    let successCount = 0;
    let errorCount = 0;
    
    jimQueries.forEach((query, i) => {
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
                if (successCount + errorCount === jimQueries.length) {
                    console.log(`\n📈 插入完成統計:`);
                    console.log(`   成功: ${successCount} 條`);
                    console.log(`   失敗: ${errorCount} 條`);
                    console.log(`   總計: ${jimQueries.length} 條`);
                    
                    // 驗證插入結果
                    console.log('\n🔍 驗證插入結果...');
                    db.get(`
                        SELECT 
                            COUNT(*) as total_queries,
                            COUNT(CASE WHEN type = 'stock' THEN 1 END) as stock_queries,
                            COUNT(CASE WHEN type = 'ai' THEN 1 END) as ai_queries,
                            COUNT(CASE WHEN type = 'prediction' THEN 1 END) as prediction_queries,
                            COUNT(CASE WHEN type = 'analysis' THEN 1 END) as analysis_queries,
                            COUNT(CASE WHEN username = 'jim' THEN 1 END) as jim_queries,
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
                            console.log(`   Jim 用戶查詢: ${stats.jim_queries}`);
                            console.log(`   今日查詢: ${stats.today_queries}`);
                        }
                        
                        console.log('\n🎯 Jim 用戶查詢記錄添加完成！');
                        console.log('\n🌐 測試頁面:');
                        console.log('   查詢記錄: https://www.bma-hk.com/admin-queries');
                        console.log('   用戶管理: https://www.bma-hk.com/admin');
                        
                        console.log('\n🔧 測試步驟:');
                        console.log('1. 登入管理員帳戶');
                        console.log('2. 前往查詢記錄頁面');
                        console.log('3. 在篩選器中選擇 "jim" 用戶');
                        console.log('4. 查看 Jim 用戶的查詢記錄');
                        
                        db.close();
                    });
                }
            }
        );
    });
}

// 開始添加 Jim 用戶查詢記錄
addJimQueries();
