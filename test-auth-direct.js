#!/usr/bin/env node

const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

console.log('🔐 直接認證測試...\n');

const dbPath = path.join(__dirname, 'database', 'users.db');
const db = new sqlite3.Database(dbPath);

// 測試認證
async function testAuth() {
    console.log('🔍 檢查數據庫狀態...');
    
    // 檢查用戶表
    db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
        if (err) {
            console.error('❌ 檢查用戶表失敗:', err.message);
            return;
        }
        console.log(`✅ 用戶表記錄數: ${row.count}`);
        
        // 檢查管理員用戶
        db.get('SELECT * FROM users WHERE role = "admin" LIMIT 1', async (err, admin) => {
            if (err) {
                console.error('❌ 檢查管理員用戶失敗:', err.message);
                return;
            }
            
            if (!admin) {
                console.log('⚠️ 未找到管理員用戶，創建中...');
                await createAdminUser();
                return;
            }
            
            console.log(`✅ 找到管理員用戶: ${admin.username}`);
            console.log(`   用戶名: ${admin.username}`);
            console.log(`   角色: ${admin.role}`);
            console.log(`   狀態: ${admin.status}`);
            console.log(`   創建時間: ${admin.created_at}`);
            
            // 測試密碼
            console.log('\n🔐 測試密碼驗證...');
            try {
                const testPasswords = ['admin123', 'Admin1234!', 'admin', 'password'];
                
                for (const testPassword of testPasswords) {
                    const isValid = await bcrypt.compare(testPassword, admin.password_hash);
                    if (isValid) {
                        console.log(`✅ 密碼驗證成功: ${testPassword}`);
                        break;
                    } else {
                        console.log(`❌ 密碼驗證失敗: ${testPassword}`);
                    }
                }
            } catch (error) {
                console.error('❌ 密碼驗證錯誤:', error.message);
            }
            
            // 檢查查詢記錄
            db.get('SELECT COUNT(*) as count FROM user_queries WHERE type = "ai"', (err, row) => {
                if (err) {
                    console.error('❌ 檢查 AI 查詢失敗:', err.message);
                } else {
                    console.log(`\n📊 AI 查詢記錄數量: ${row.count}`);
                    
                    if (row.count === 0) {
                        console.log('🤖 添加 AI 查詢記錄...');
                        addAIQueries();
                    } else {
                        console.log('✅ AI 查詢記錄已存在');
                        showStats();
                    }
                }
            });
        });
    });
}

// 創建管理員用戶
async function createAdminUser() {
    try {
        const password = 'admin123';
        const passwordHash = await bcrypt.hash(password, 10);
        
        db.run(
            'INSERT INTO users (username, email, password_hash, full_name, role, api_quota, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            ['admin', 'admin@bma-hk.com', passwordHash, 'System Administrator', 'admin', 10000, 'active'],
            function(err) {
                if (err) {
                    console.error('❌ 創建管理員用戶失敗:', err.message);
                } else {
                    console.log(`✅ 管理員用戶創建成功 (ID: ${this.lastID})`);
                    console.log(`   用戶名: admin`);
                    console.log(`   密碼: admin123`);
                    console.log(`   角色: admin`);
                    
                    // 添加 AI 查詢記錄
                    addAIQueries();
                }
            }
        );
    } catch (error) {
        console.error('❌ 創建管理員用戶時發生錯誤:', error.message);
    }
}

// 添加 AI 查詢記錄
function addAIQueries() {
    const aiQueries = [
        {
            username: 'admin',
            type: 'ai',
            content: 'AI，請解釋什麼是量化交易？',
            result: '量化交易是利用數學模型和算法來執行交易策略的投資方法。',
            metadata: '{"model":"GPT-4","category":"education"}'
        },
        {
            username: 'admin',
            type: 'ai',
            content: '分析比特幣的技術指標',
            result: '根據技術分析，比特幣目前處於關鍵支撐位附近。',
            metadata: '{"symbol":"BTC","analysis_type":"technical"}'
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
                    showStats();
                }
            }
        );
    });
}

// 顯示統計
function showStats() {
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
        
        console.log('\n🎯 認證測試完成！');
        console.log('\n🌐 測試頁面:');
        console.log('   基本登入: https://www.bma-hk.com/basic-login.html');
        console.log('   簡單登入: https://www.bma-hk.com/simple-login.html');
        console.log('   管理頁面: https://www.bma-hk.com/admin');
        console.log('   查詢記錄: https://www.bma-hk.com/admin-queries');
        
        db.close();
    });
}

// 開始測試
testAuth();
