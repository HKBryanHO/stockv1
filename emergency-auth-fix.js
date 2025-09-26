#!/usr/bin/env node

const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

console.log('🚨 緊急認證修復...\n');

// 數據庫路徑
const dbPath = path.join(__dirname, 'database', 'users.db');

// 確保數據庫目錄存在
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log('✅ 創建數據庫目錄:', dbDir);
}

// 創建數據庫連接
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ 無法連接數據庫:', err.message);
        process.exit(1);
    }
    console.log('✅ 已連接到數據庫:', dbPath);
});

// 緊急認證修復
async function emergencyAuthFix() {
    try {
        console.log('🔄 開始緊急認證修復...');
        
        // 1. 清理並重建所有表
        console.log('🗑️ 清理現有數據...');
        db.exec('DROP TABLE IF EXISTS user_sessions;');
        db.exec('DROP TABLE IF EXISTS user_queries;');
        db.exec('DROP TABLE IF EXISTS user_portfolios;');
        db.exec('DROP TABLE IF EXISTS user_predictions;');
        db.exec('DROP TABLE IF EXISTS users;');
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 2. 重新創建所有表
        console.log('🏗️ 重新創建數據庫表...');
        const createTablesSQL = `
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                full_name VARCHAR(100),
                role TEXT DEFAULT 'user' CHECK(role IN ('admin', 'user', 'premium')),
                status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'suspended')),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME,
                preferences TEXT,
                api_quota INTEGER DEFAULT 1000,
                api_usage INTEGER DEFAULT 0
            );

            CREATE TABLE user_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                session_token VARCHAR(255) UNIQUE NOT NULL,
                expires_at DATETIME NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                ip_address VARCHAR(45),
                user_agent TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE user_portfolios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name VARCHAR(100) NOT NULL,
                holdings TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_default INTEGER DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE user_predictions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                symbol VARCHAR(20) NOT NULL,
                prediction_data TEXT NOT NULL,
                model_used VARCHAR(50),
                confidence_score REAL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE user_queries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username VARCHAR(50) NOT NULL,
                type VARCHAR(20) NOT NULL CHECK(type IN ('stock', 'ai', 'prediction', 'analysis')),
                content TEXT NOT NULL,
                result TEXT,
                metadata TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
            );

            CREATE INDEX idx_users_username ON users(username);
            CREATE INDEX idx_users_email ON users(email);
            CREATE INDEX idx_users_status ON users(status);
            CREATE INDEX idx_sessions_token ON user_sessions(session_token);
            CREATE INDEX idx_sessions_user_id ON user_sessions(user_id);
            CREATE INDEX idx_sessions_expires ON user_sessions(expires_at);
            CREATE INDEX idx_portfolios_user_id ON user_portfolios(user_id);
            CREATE INDEX idx_predictions_user_id ON user_predictions(user_id);
            CREATE INDEX idx_predictions_symbol ON user_predictions(symbol);
            CREATE INDEX idx_queries_username ON user_queries(username);
            CREATE INDEX idx_queries_type ON user_queries(type);
            CREATE INDEX idx_queries_created_at ON user_queries(created_at);
        `;
        
        db.exec(createTablesSQL, (err) => {
            if (err) {
                console.error('❌ 創建表失敗:', err.message);
                process.exit(1);
            }
            console.log('✅ 數據庫表創建成功');
        });
        
        // 3. 創建多個管理員用戶
        console.log('👤 創建管理員用戶...');
        const adminUsers = [
            {
                username: 'admin',
                email: 'admin@bma-hk.com',
                password: 'admin123',
                full_name: 'System Administrator',
                role: 'admin'
            },
            {
                username: 'administrator',
                email: 'administrator@bma-hk.com',
                password: 'admin123',
                full_name: 'Administrator',
                role: 'admin'
            },
            {
                username: 'Bryanho',
                email: 'bryanho@bma-hk.com',
                password: 'Bryanho123',
                full_name: 'Bryan Ho',
                role: 'admin'
            }
        ];
        
        let userCount = 0;
        adminUsers.forEach(async (user, i) => {
            try {
                const passwordHash = await bcrypt.hash(user.password, 10);
                
                db.run(
                    'INSERT INTO users (username, email, password_hash, full_name, role, api_quota, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [user.username, user.email, passwordHash, user.full_name, user.role, 10000, 'active'],
                    function(err) {
                        if (err) {
                            console.error(`❌ 創建用戶 ${user.username} 失敗:`, err.message);
                        } else {
                            console.log(`✅ 用戶 ${user.username} 創建成功 (ID: ${this.lastID})`);
                            console.log(`   用戶名: ${user.username}`);
                            console.log(`   密碼: ${user.password}`);
                            console.log(`   角色: ${user.role}`);
                        }
                        
                        userCount++;
                        if (userCount === adminUsers.length) {
                            // 4. 添加 AI 查詢記錄
                            console.log('\n🤖 添加 AI 查詢記錄...');
                            addAIQueries();
                        }
                    }
                );
            } catch (error) {
                console.error(`❌ 處理用戶 ${user.username} 時發生錯誤:`, error.message);
            }
        });
        
    } catch (error) {
        console.error('❌ 緊急認證修復過程中發生錯誤:', error.message);
        process.exit(1);
    }
}

// 添加 AI 查詢記錄
function addAIQueries() {
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
    
    let completed = 0;
    aiQueries.forEach((query, i) => {
        db.run(
            'INSERT INTO user_queries (username, type, content, result, metadata) VALUES (?, ?, ?, ?, ?)',
            [query.username, query.type, query.content, query.result, query.metadata],
            function(err) {
                if (err) {
                    console.warn(`⚠️ 插入 AI 查詢 ${i + 1} 失敗:`, err.message);
                } else {
                    console.log(`✅ AI 查詢 ${i + 1} 插入成功 (ID: ${this.lastID})`);
                }
                
                completed++;
                if (completed === aiQueries.length) {
                    // 5. 驗證結果
                    console.log('\n🔍 驗證修復結果...');
                    db.get('SELECT COUNT(*) as count FROM users WHERE role = "admin"', (err, row) => {
                        if (err) {
                            console.error('❌ 驗證管理員用戶失敗:', err.message);
                        } else {
                            console.log(`✅ 管理員用戶數量: ${row.count}`);
                        }
                        
                        db.get('SELECT COUNT(*) as count FROM user_queries WHERE type = "ai"', (err, row) => {
                            if (err) {
                                console.error('❌ 驗證 AI 查詢失敗:', err.message);
                            } else {
                                console.log(`✅ AI 查詢記錄數量: ${row.count}`);
                            }
                            
                            // 顯示統計
                            db.get(`
                                SELECT 
                                    COUNT(*) as total_queries,
                                    COUNT(CASE WHEN type = 'stock' THEN 1 END) as stock_queries,
                                    COUNT(CASE WHEN type = 'ai' THEN 1 END) as ai_queries,
                                    COUNT(CASE WHEN type = 'prediction' THEN 1 END) as prediction_queries,
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
                                    console.log(`   今日查詢: ${stats.today_queries}`);
                                }
                                
                                console.log('\n🎯 緊急認證修復完成！');
                                console.log('\n📋 可用的管理員帳戶:');
                                console.log('   用戶名: admin, 密碼: admin123');
                                console.log('   用戶名: administrator, 密碼: admin123');
                                console.log('   用戶名: Bryanho, 密碼: Bryanho123');
                                
                                console.log('\n🌐 測試頁面:');
                                console.log('   基本登入: https://www.bma-hk.com/basic-login.html');
                                console.log('   簡單登入: https://www.bma-hk.com/simple-login.html');
                                console.log('   標準登入: https://www.bma-hk.com/login.html');
                                console.log('   管理頁面: https://www.bma-hk.com/admin');
                                console.log('   查詢記錄: https://www.bma-hk.com/admin-queries');
                                
                                console.log('\n🔧 如果仍有問題:');
                                console.log('1. 清除瀏覽器緩存和 Cookie');
                                console.log('2. 重新啟動服務器');
                                console.log('3. 檢查服務器日誌');
                                console.log('4. 確認數據庫文件權限');
                                
                                db.close();
                            });
                        });
                    });
                }
            }
        );
    });
}

// 開始緊急修復
emergencyAuthFix();
