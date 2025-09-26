#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

console.log('🔧 初始化查詢記錄表...\n');

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

// 創建查詢記錄表
function createQueryTables() {
    console.log('🏗️ 創建查詢記錄表...');
    
    const createTableSQL = `
        CREATE TABLE IF NOT EXISTS user_queries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username VARCHAR(50) NOT NULL,
            type VARCHAR(20) NOT NULL CHECK(type IN ('stock', 'ai', 'prediction', 'analysis')),
            content TEXT NOT NULL,
            result TEXT,
            metadata TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
        );
    `;
    
    db.exec(createTableSQL, (err) => {
        if (err) {
            console.error('❌ 創建查詢記錄表失敗:', err.message);
            process.exit(1);
        }
        console.log('✅ 查詢記錄表創建成功');
    });
    
    // 創建索引
    console.log('📊 創建索引...');
    const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_queries_username ON user_queries(username);',
        'CREATE INDEX IF NOT EXISTS idx_queries_type ON user_queries(type);',
        'CREATE INDEX IF NOT EXISTS idx_queries_created_at ON user_queries(created_at);'
    ];
    
    indexes.forEach((indexSQL, i) => {
        db.exec(indexSQL, (err) => {
            if (err) {
                console.warn(`⚠️ 創建索引 ${i + 1} 警告:`, err.message);
            } else {
                console.log(`✅ 索引 ${i + 1} 創建成功`);
            }
        });
    });
    
    // 插入一些示例數據
    console.log('📝 插入示例數據...');
    const sampleQueries = [
        {
            username: 'admin',
            type: 'stock',
            content: '查詢 AAPL 股票價格',
            result: 'AAPL 當前價格: $150.25，漲幅: +2.5%',
            metadata: JSON.stringify({ symbol: 'AAPL', price: 150.25, change: 2.5 })
        },
        {
            username: 'admin',
            type: 'ai',
            content: '分析市場趨勢',
            result: '根據技術分析，市場呈現上漲趨勢，建議關注科技股',
            metadata: JSON.stringify({ analysis_type: 'technical', confidence: 0.85 })
        },
        {
            username: 'admin',
            type: 'prediction',
            content: '預測 TSLA 未來走勢',
            result: 'TSLA 預計在未來30天內上漲15-20%',
            metadata: JSON.stringify({ symbol: 'TSLA', prediction: 'bullish', timeframe: '30d' })
        }
    ];
    
    const insertSQL = `INSERT INTO user_queries (username, type, content, result, metadata) VALUES (?, ?, ?, ?, ?)`;
    
    sampleQueries.forEach((query, i) => {
        db.run(insertSQL, [query.username, query.type, query.content, query.result, query.metadata], function(err) {
            if (err) {
                console.warn(`⚠️ 插入示例數據 ${i + 1} 警告:`, err.message);
            } else {
                console.log(`✅ 示例數據 ${i + 1} 插入成功 (ID: ${this.lastID})`);
            }
        });
    });
    
    // 等待一下讓所有操作完成
    setTimeout(() => {
        console.log('\n🎯 初始化完成！');
        console.log('\n📋 查詢記錄功能:');
        console.log('1. 查看所有用戶的查詢記錄');
        console.log('2. 按類型篩選 (股票、AI、預測)');
        console.log('3. 按用戶篩選');
        console.log('4. 按日期範圍篩選');
        console.log('5. 關鍵字搜索');
        console.log('6. 查看詳細查詢內容');
        console.log('7. 導出查詢記錄');
        
        console.log('\n🌐 訪問頁面:');
        console.log('   查詢記錄: https://www.bma-hk.com/admin-queries');
        console.log('   用戶管理: https://www.bma-hk.com/admin');
        
        db.close();
    }, 2000);
}

// 開始初始化
createQueryTables();
