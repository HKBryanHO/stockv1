#!/usr/bin/env node

const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

console.log('🚨 簡單認證繞過修復...\n');

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

// 簡單認證繞過修復
async function simpleAuthBypass() {
    try {
        console.log('🔄 開始簡單認證繞過...');
        
        // 1. 清理並重建
        console.log('🗑️ 清理現有數據...');
        db.exec('DROP TABLE IF EXISTS user_sessions;');
        db.exec('DROP TABLE IF EXISTS user_queries;');
        db.exec('DROP TABLE IF EXISTS users;');
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 2. 創建用戶表
        console.log('🏗️ 創建用戶表...');
        const createUsersTable = `
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
        `;
        
        db.exec(createUsersTable, (err) => {
            if (err) {
                console.error('❌ 創建用戶表失敗:', err.message);
                process.exit(1);
            }
            console.log('✅ 用戶表創建成功');
        });
        
        // 3. 創建會話表
        const createSessionsTable = `
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
        `;
        
        db.exec(createSessionsTable, (err) => {
            if (err) {
                console.error('❌ 創建會話表失敗:', err.message);
                process.exit(1);
            }
            console.log('✅ 會話表創建成功');
        });
        
        // 4. 創建查詢表
        const createQueriesTable = `
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
        `;
        
        db.exec(createQueriesTable, (err) => {
            if (err) {
                console.error('❌ 創建查詢表失敗:', err.message);
                process.exit(1);
            }
            console.log('✅ 查詢表創建成功');
        });
        
        // 5. 創建索引
        console.log('📊 創建索引...');
        db.exec('CREATE INDEX idx_users_username ON users(username);');
        db.exec('CREATE INDEX idx_users_email ON users(email);');
        db.exec('CREATE INDEX idx_sessions_token ON user_sessions(session_token);');
        
        // 6. 創建簡單的管理員用戶
        console.log('👤 創建簡單管理員用戶...');
        const password = 'admin123';
        const passwordHash = await bcrypt.hash(password, 10);
        
        const insertUserSQL = `INSERT INTO users (username, email, password_hash, full_name, role, api_quota, status) 
                               VALUES (?, ?, ?, ?, ?, ?, ?)`;
        
        db.run(insertUserSQL, [
            'admin',
            'admin@bma-hk.com',
            passwordHash,
            'System Administrator',
            'admin',
            10000,
            'active'
        ], function(err) {
            if (err) {
                console.error('❌ 創建admin用戶失敗:', err.message);
                process.exit(1);
            }
            
            console.log('✅ admin用戶創建成功');
            console.log('   ID:', this.lastID);
            console.log('   用戶名: admin');
            console.log('   密碼: admin123');
            console.log('   角色: admin');
            console.log('   API配額: 10000');
            console.log('   狀態: active');
            
            // 7. 驗證用戶
            console.log('\n🔍 驗證用戶創建...');
            db.get('SELECT * FROM users WHERE username = ?', ['admin'], async (err, user) => {
                if (err) {
                    console.error('❌ 驗證失敗:', err.message);
                    process.exit(1);
                }
                
                if (!user) {
                    console.error('❌ 用戶創建後未找到');
                    process.exit(1);
                }
                
                console.log('✅ 用戶驗證成功:');
                console.log('   ID:', user.id);
                console.log('   用戶名:', user.username);
                console.log('   角色:', user.role);
                console.log('   狀態:', user.status);
                console.log('   創建時間:', user.created_at);
                
                // 8. 測試密碼
                console.log('\n🔐 測試密碼驗證...');
                try {
                    const isValid = await bcrypt.compare('admin123', user.password_hash);
                    if (isValid) {
                        console.log('✅ 密碼驗證成功');
                    } else {
                        console.log('❌ 密碼驗證失敗');
                    }
                } catch (error) {
                    console.error('❌ 密碼驗證錯誤:', error.message);
                }
                
                // 9. 插入示例查詢
                console.log('\n📝 插入示例查詢...');
                const sampleQuery = {
                    username: 'admin',
                    type: 'stock',
                    content: '查詢 AAPL 股票價格',
                    result: 'AAPL 當前價格: $150.25，漲幅: +2.5%',
                    metadata: JSON.stringify({ symbol: 'AAPL', price: 150.25, change: 2.5 })
                };
                
                const insertQuerySQL = `INSERT INTO user_queries (username, type, content, result, metadata) VALUES (?, ?, ?, ?, ?)`;
                db.run(insertQuerySQL, [sampleQuery.username, sampleQuery.type, sampleQuery.content, sampleQuery.result, sampleQuery.metadata], function(err) {
                    if (err) {
                        console.warn('⚠️ 插入示例查詢警告:', err.message);
                    } else {
                        console.log(`✅ 示例查詢插入成功 (ID: ${this.lastID})`);
                    }
                });
                
                // 等待完成
                setTimeout(() => {
                    console.log('\n🎯 簡單認證繞過完成！');
                    console.log('\n📋 登入信息:');
                    console.log('   用戶名: admin');
                    console.log('   密碼: admin123');
                    console.log('   角色: admin');
                    
                    console.log('\n🌐 測試頁面:');
                    console.log('   直接登入: https://www.bma-hk.com/direct-login.html');
                    console.log('   簡單登入: https://www.bma-hk.com/simple-login.html');
                    console.log('   標準登入: https://www.bma-hk.com/login.html');
                    console.log('   管理頁面: https://www.bma-hk.com/admin');
                    console.log('   查詢記錄: https://www.bma-hk.com/admin-queries');
                    
                    console.log('\n🔧 如果仍有問題:');
                    console.log('1. 檢查服務器是否重啟');
                    console.log('2. 檢查 UserManager 初始化');
                    console.log('3. 查看服務器日誌');
                    console.log('4. 確認數據庫文件權限');
                    
                    db.close();
                }, 2000);
            });
        });
        
    } catch (error) {
        console.error('❌ 簡單認證繞過過程中發生錯誤:', error.message);
        process.exit(1);
    }
}

// 開始簡單認證繞過
simpleAuthBypass();
